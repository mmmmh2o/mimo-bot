<template>
  <div class="status-bar">
    <div class="status-indicator" :class="statusClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
    <div class="status-detail" v-if="isRunning">
      <span class="status-step">{{ currentStep }}/{{ totalSteps }}</span>
      <span class="status-elapsed">{{ formattedElapsed }}</span>
    </div>
    <div class="status-actions" v-if="isRunning">
      <el-button size="small" @click="pause" v-if="!isPaused" title="暂停">⏸</el-button>
      <el-button size="small" @click="resume" v-else title="恢复">▶</el-button>
      <el-button size="small" type="danger" @click="stop" title="停止">🛑</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()
const elapsed = ref(0)
let timer = null

const isRunning = computed(() => flowStore.isRunning)
const isPaused = computed(() => flowStore.isPaused)
const currentStep = computed(() => flowStore.currentStep || 0)
const totalSteps = computed(() => flowStore.totalSteps || 0)

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

const formattedElapsed = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const pause = () => flowStore.pauseFlow()
const resume = () => flowStore.resumeFlow()
const stop = () => flowStore.stopFlow()

onMounted(() => {
  timer = setInterval(() => {
    if (flowStore.isRunning && flowStore.startTime) {
      elapsed.value = Math.round((Date.now() - flowStore.startTime) / 1000)
    } else {
      elapsed.value = 0
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  gap: 8px;
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
  flex-shrink: 0;
}

.status-idle .status-dot { background: #666; }
.status-running .status-dot { background: #4caf50; animation: pulse 1.5s infinite; }
.status-paused .status-dot { background: #ff9800; }

.status-text {
  color: #a0a0b0;
  white-space: nowrap;
}

.status-detail {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
}

.status-step {
  color: #4fc3f7;
  font-family: monospace;
}

.status-elapsed {
  color: #888;
  font-family: monospace;
}

.status-actions {
  display: flex;
  gap: 4px;
}

.status-actions .el-button {
  padding: 4px 8px;
  font-size: 12px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
