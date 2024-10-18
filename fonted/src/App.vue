<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Quill from 'quill'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import 'quill/dist/quill.snow.css'

// 引用编辑器DOM元素
const editorRef = ref<HTMLElement | null>(null)
  function loadDocument(docId:string){
    console.log(docId);
    
      
    // 创建Y文档
    const ydoc = new Y.Doc()

    //到WebSocket服务器
    const provider = new WebsocketProvider(`ws://localhost:3000`, docId , ydoc)

    // 创建共享类型
    const ytext = ydoc.getText('quill')

    // 初始化Quill编辑器
    console.log(editorRef.value);

    const quill = new Quill(editorRef.value, {
      modules: {
        toolbar: [
          [{ header: [1, 2, false] }],
          ['bold', 'italic', 'underline'],
          ['image', 'code-block']
        ]
      },
      theme: 'snow'
    })

    // 将Quill与Y.js绑定
    const binding = new QuillBinding(ytext, quill)

    // 监听连接状态
    provider.on('status', (event: { status: string }) => {
      console.log(event.status) // 输出连接状态
    })

    // 错误处理
    provider.on('connection-error', (error: Error) => {
      console.error('连接错误:', error)
    })
  }

onMounted(() => {
  if (editorRef.value) {
    loadDocument('123')
  }
})
</script>

<template>
 <div ref="editorRef" class="editor"></div>
</template>

<style scoped>
.editor {
  height: 400px;
  width: 100%;
}
</style>
