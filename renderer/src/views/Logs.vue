<template>
  <div class="logs-page">
    <h1>📊 日志</h1>

    <div class="log-toolbar">
      <el-select v-model="logLevel" placeholder="日志级别" clearable>
        <el-option label="DEBUG" value="debug" />
        <el-option label="INFO" value="info" />
        <el-option label="WARN" value="warn" />
        <el-option label="ERROR" value="error" />
      </el-select>
      <el-input
        v-model="searchText"
        placeholder="搜索日志..."
        clearable
        style="width: 300px"
      />
      <el-switch v-model="autoScroll" active-text="自动滚动" />
      <el-button @click="clearLogs">🗑️ 清空</el-button>
      <el-button @click="exportLogs">📤 导出</el-button>
    </div>

    <div class="log-container" ref="logContainer">
      <div
        v-for="(log, index) in filteredLogs"
        :key="index"
        class="log-line"
        :class="'log-' + log.level"
      >
        <span class="log-time">{{ log.time }}</span>
        <span class="log-level" :class="'level-' + log.level">{{ log.level.toUpperCase() }}</span>
        <span class="log-source">{{ log.source }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="filteredLogs.length === 0" class="log-empty">
        暂无日志
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const logLevel = ref('')
const searchText = ref('')
const autoScroll = ref(true)
const logContainer = ref(null)
const logs = ref([])

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (logLevel.value && log.level !== logLevel.value) return false
    if (searchText.value && !log.message.toLowerCase().includes(searchText.value.toLowerCase())) return false
    return true
  })
})

watch(filteredLogs, async () => {
  if (autoScroll.value) {
    await nextTick()
    logContainer.value?.scrollTo(0, logContainer.value.scrollHeight)
  }
})

const clearLogs = () => { logs.value = [] }
const exportLogs = () => {
  // TODO: 导出日志文件
}
</script>

<style scoped>
.logs-page {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

h1 {
  color: #fff;
  margin-bottom: 16px;
}

.log-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.log-container {
  flex: 1;
  background: #0a0a14;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 12px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.log-line {
  display: flex;
  gap: 12px;
  padding: 2px 0;
}

.log-time {
  color: #666;
  min-width: 90px;
}

.log-level {
  min-width: 55px;
  font-weight: 600;
}

.level-debug { color: #888; }
.level-info { color: #4fc3f7; }
.level-warn { color: #ff9800; }
.level-error { color: #f44336; }

.log-source {
  color: #9c27b0;
  min-width: 80px;
}

.log-message {
  color: #ccc;
  word-break: break-all;
}

.log-empty {
  color: #555;
  text-align: center;
  padding: 40px;
}
</style>
