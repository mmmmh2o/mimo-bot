<template>
  <div class="dashboard">
    <h1>🏠 仪表盘</h1>

    <!-- 系统状态 -->
    <div class="system-status" v-if="engineStatus.running">
      <el-alert
        :title="`⚡ 流程运行中 — ${engineStatus.flowName || '未知'} (${engineStatus.step}/${engineStatus.totalSteps})`"
        type="warning"
        :closable="false"
        show-icon
      />
    </div>

    <!-- 概览卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-value">{{ stats.runCount }}</div>
        <div class="stat-label">今日运行次数</div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-value">{{ stats.successRate }}%</div>
        <div class="stat-label">成功率</div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-value">{{ stats.totalTurns }}</div>
        <div class="stat-label">总对话轮次</div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-value">{{ stats.flowCount }}</div>
        <div class="stat-label">流程数量</div>
      </el-card>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <el-button type="primary" @click="$router.push('/flows')" :disabled="engineStatus.running">
        🔀 运行流程
      </el-button>
      <el-button @click="$router.push('/flows')">
        ➕ 新建流程
      </el-button>
      <el-button @click="$router.push('/logs')">
        📊 查看日志
      </el-button>
      <el-button @click="refresh" :loading="loading">
        🔄 刷新
      </el-button>
    </div>

    <!-- 最近运行 -->
    <el-card class="recent-runs" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>📋 最近运行</span>
          <el-tag size="small">{{ recentRuns.length }} 条记录</el-tag>
        </div>
      </template>
      <el-table :data="recentRuns" stripe v-loading="loading" empty-text="暂无运行记录">
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column prop="flowName" label="流程" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : row.status === 'running' ? 'warning' : 'danger'" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="turns" label="对话轮次" width="100" />
        <el-table-column prop="duration" label="耗时" width="100" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()
const loading = ref(false)

const stats = reactive({
  runCount: 0,
  successRate: 100,
  totalTurns: 0,
  flowCount: 0,
})

const engineStatus = reactive({
  running: false,
  paused: false,
  flowName: '',
  step: 0,
  totalSteps: 0,
})

const recentRuns = ref([])

const statusLabel = (status) => ({
  success: '✅ 完成',
  running: '⏳ 运行中',
  failed: '❌ 失败',
}[status] || status)

const refresh = async () => {
  loading.value = true
  try {
    // 加载流程列表
    await flowStore.loadFlowList()
    stats.flowCount = flowStore.flowList.length

    // 加载引擎状态
    const status = await window.api.flow.getStatus()
    Object.assign(engineStatus, status)

    // 加载最近运行历史
    const history = await window.api.flow.getHistory(null, { limit: 20 })
    if (history && Array.isArray(history)) {
      recentRuns.value = history.map(h => ({
        time: new Date(h.created_at || h.timestamp).toLocaleString(),
        flowName: h.flow_name || h.flow_id || '未知',
        status: h.status || 'success',
        turns: h.turns || '-',
        duration: h.duration ? `${h.duration}s` : '-',
      }))

      // 统计今日运行
      const today = new Date().toDateString()
      const todayRuns = history.filter(h =>
        new Date(h.created_at || h.timestamp).toDateString() === today
      )
      stats.runCount = todayRuns.length
      const successRuns = todayRuns.filter(h => h.status === 'success').length
      stats.successRate = todayRuns.length > 0
        ? Math.round((successRuns / todayRuns.length) * 100)
        : 100
      stats.totalTurns = history.reduce((sum, h) => sum + (h.turns || 0), 0)
    }
  } catch (e) {
    console.error('Dashboard refresh error:', e)
  } finally {
    loading.value = false
  }
}

let refreshTimer = null

onMounted(() => {
  refresh()
  // 每 10s 刷新引擎状态
  refreshTimer = setInterval(async () => {
    try {
      const status = await window.api.flow.getStatus()
      Object.assign(engineStatus, status)
    } catch (e) { /* ignore */ }
  }, 10000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.dashboard {
  padding: 24px;
}

h1 {
  margin-bottom: 24px;
  color: #fff;
}

.system-status {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #4fc3f7;
}

.stat-label {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.quick-actions {
  margin-bottom: 24px;
  display: flex;
  gap: 8px;
}

.recent-runs {
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
