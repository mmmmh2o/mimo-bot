<template>
  <div class="status-bar">
    <div class="status-indicator" :class="statusClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
    <div class="status-actions" v-if="isRunning">
      <el-button size="small" @click="pause" v-if="!isPaused">⏸</el-button>
      <el-button size="small" @click="resume" v-else>▶</el-button>
      <el-button size="small" type="danger" @click="stop">🛑</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()

const isRunning = computed(() => flowStore.isRunning)
const isPaused = computed(() => flowStore.isPaused)

const statusText = computed(() => {
  if (isPaused.value) return '已暂停'
  if (isRunning.value) return '运行中'
  return '空闲'
})

const statusClass = computed(() => ({
  'status-idle': !isRunning.value,
  'status-running': isRunning.value && !isPaused.value,
  'status-paused': isPaused.value,
}))

const pause = () => flowStore.pauseFlow()
const resume = () => flowStore.resumeFlow()
const stop = () => flowStore.stopFlow()
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-idle .status-dot { background: #666; }
.status-running .status-dot { background: #4caf50; animation: pulse 1.5s infinite; }
.status-paused .status-dot { background: #ff9800; }

.status-text {
  color: #a0a0b0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
