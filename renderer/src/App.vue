<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <span class="logo-icon">🤖</span>
        <div class="logo-info">
          <span class="logo-text">MiMo Bot</span>
          <span class="logo-version">v0.1.0</span>
        </div>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="transparent"
        text-color="#8b949e"
        active-text-color="#58a6ff"
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', Roboto, sans-serif;
  background: #0d1117;
  color: #e6edf3;
  -webkit-font-smoothing: antialiased;
}

.app-container { height: 100vh; }

/* 侧边栏 */
.sidebar {
  background: #0d1117;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #21262d;
}

.logo {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #21262d;
}

.logo-icon {
  font-size: 26px;
}

.logo-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: #e6edf3;
  letter-spacing: -0.3px;
}

.logo-version {
  font-size: 10px;
  color: #484f58;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  padding-top: 8px;
}

.sidebar-menu .el-menu-item {
  margin: 2px 8px;
  border-radius: 8px;
  height: 40px;
  line-height: 40px;
  transition: all 0.15s ease;
}

.sidebar-menu .el-menu-item:hover {
  background: #161b22 !important;
  color: #e6edf3 !important;
}

.sidebar-menu .el-menu-item.is-active {
  background: #161b22 !important;
  color: #58a6ff !important;
  font-weight: 500;
}

.sidebar-status {
  padding: 12px 16px;
  border-top: 1px solid #21262d;
}

/* 主内容区 */
.main-content {
  background: #0d1117;
  padding: 0;
  overflow: auto;
}

/* 全局 Element Plus 暗色覆盖 */
.el-select-dropdown {
  background: #161b22 !important;
  border-color: #30363d !important;
}

.el-button {
  border-radius: 8px;
  font-weight: 500;
}

.el-input__wrapper,
.el-textarea__inner {
  background: #0d1117 !important;
  border-color: #30363d !important;
  box-shadow: none !important;
  color: #e6edf3;
}

.el-input__wrapper:hover,
.el-textarea__inner:hover {
  border-color: #58a6ff !important;
}

.el-form-item__label {
  color: #8b949e !important;
  font-size: 12px;
}

.el-card {
  background: #161b22;
  border-color: #21262d;
  border-radius: 10px;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}
</style>
