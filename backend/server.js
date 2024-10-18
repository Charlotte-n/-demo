const express = require('express')
const http = require('http')
const {WebSocketServer} = require('ws')
const {MongodbPersistence} = require('y-mongodb-provider')
const { setPersistence,setupWSConnection } = require('y-websocket/bin/utils')
const Y = require('yjs');
const mongoose = require('mongoose');
// 定期运行压缩操作，例如每天凌晨 2 点
const cron = require('node-cron');


const app = express()
const server = http.createServer(({request,response})=>{
    response.writeHead(200, { 'Content-Type': 'text/plain' });
	response.end('okay');
})

// 连接y-websocket，ws://localhost:3000
const wsServer = new WebSocketServer({server})
// y-mongodb-provider
const mdb = new MongodbPersistence('mongodb://127.0.0.1:27017/testYjs',{
    flushSize: 100,
    multipleCollections:false
})


async function compressDocumentUpdates(docName) {
  try {
    // 1. 获取文档的所有更新
    const updates = await mdb.getUpdates(docName);
    
    if (updates.length === 0) {
      console.log(
`No updates found for document: ${docName}`);
      return;
    }

    // 2. 创建一个新的 Y.Doc 实例
    const ydoc = new Y.Doc();

    // 3. 应用所有更新到这个文档
    updates.forEach(update => Y.applyUpdate(ydoc, update));

    // 4. 将当前状态编码为单个更新
    const compressedUpdate = Y.encodeStateAsUpdate(ydoc);

    // 5. 删除旧的更新
    await mdb.clearUpdates(docName);

    // 6. 存储压缩后的更新
    await mdb.storeUpdate(docName, compressedUpdate);

    console.log(`Successfully compressed updates for document: ${docName}`);
  } catch (error) {
    console.error(`Error compressing updates for document ${docName}:`, error);
  }
}

// 使用示例
async function compressAllDocuments() {
  // 获取所有文档名称（这取决于你如何存储文档名称）
  const docNames = await getAllDocumentNames();
  
  for (const docName of docNames) {
    await compressDocumentUpdates(docName);
  }
}


cron.schedule('0 2 * * *', () => {
  console.log('Running daily compression task');
  compressAllDocuments();
});


//连接mongodb
mongoose.connect('mongodb://127.0.0.1:27017/testYjs',{useNewUrlParser:true,useUnifiedTopology:true})


// 定义文档模型
const DocumentSchema = new mongoose.Schema({
    id: String,
    title: String,
    createdAt: Date,
    updatedAt: Date
});
const Document = mongoose.model('Document', DocumentSchema);


setPersistence(
    {
        bindState:async (docName,ydoc)=>{
            const persistedYdoc = await mdb.getYDoc(docName);
		    const newUpdates = Y.encodeStateAsUpdate(ydoc);
		    mdb.storeUpdate(docName, newUpdates);
		    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
		    ydoc.on('update', async (update) => {
			    mdb.storeUpdate(docName, update);
		    });
        },
        writeState: () => {
            return new Promise((resolve) => {
                resolve(true);
            });
        },
    }
)

wsServer.on('connection',(conn,req)=>{
    if(req.url){
        console.log(req.url.slice(1));
        
        setupWSConnection(conn,req,{docName:req.url.slice(1)})
    }else{
        conn.close()
    }
})


// API路由
app.use(express.json());

// 创建新文档
app.post('/api/documents', async (req, res) => {
    try {
      const { title } = req.body;
      const newDoc = new Document({
        id: uuidv4(),
        title,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newDoc.save();
      res.status(201).json(newDoc);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create document' });
    }
  });

// 获取特定文档
app.get('/api/documents/:id', async (req, res) => {
    try {
      const document = await Document.findOne({ id: req.params.id });
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document' });
    }
});

server.listen(3000,()=>{
    console.log('server is running on port 3000')
})
