<template>
  <el-container class="app-container">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <span class="logo-icon">🤖</span>
        <span class="logo-text">MiMo Bot</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="#1a1a2e"
        text-color="#a0a0b0"
        active-text-color="#4fc3f7"
      >
        <el-menu-item index="/">
          <el-icon><Monitor /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/flows">
          <el-icon><Connection /></el-icon>
          <span>流程编辑器</span>
        </el-menu-item>
        <el-menu-item index="/variables">
          <el-icon><Box /></el-icon>
          <span>变量管理</span>
        </el-menu-item>
        <el-menu-item index="/database">
          <el-icon><Coin /></el-icon>
          <span>数据库</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><Document /></el-icon>
          <span>日志</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-status">
        <StatusBar />
      </div>
    </el-aside>
    <el-main class="main-content">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { onMounted } from 'vue'
import { Monitor, Connection, Box, Coin, Document, Setting } from '@element-plus/icons-vue'
import StatusBar from './components/common/StatusBar.vue'
import { useFlowStore } from './stores/flow'

const flowStore = useFlowStore()

onMounted(() => {
  flowStore.subscribeEvents()
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f0f1a;
  color: #e0e0e0;
}
.app-container { height: 100vh; }
.sidebar {
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2a2a3e;
}
.logo {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #2a2a3e;
}
.logo-icon { font-size: 28px; }
.logo-text { font-size: 18px; font-weight: 600; color: #fff; }
.sidebar-menu { flex: 1; border-right: none; }
.sidebar-status { padding: 12px; border-top: 1px solid #2a2a3e; }
.main-content { background: #0f0f1a; padding: 0; overflow: auto; }
</style>
