<template>
  <div class="dashboard">
    <h1>🏠 仪表盘</h1>

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
        <div class="stat-value">{{ stats.outputFiles }}</div>
        <div class="stat-label">产出文件数</div>
      </el-card>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <el-button type="primary" @click="$router.push('/flows')">
        🔀 运行流程
      </el-button>
      <el-button @click="$router.push('/flows')">
        ➕ 新建流程
      </el-button>
      <el-button @click="$router.push('/logs')">
        📊 查看日志
      </el-button>
    </div>

    <!-- 最近运行 -->
    <el-card class="recent-runs" shadow="hover">
      <template #header>
        <span>📋 最近运行</span>
      </template>
      <el-table :data="recentRuns" stripe>
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column prop="flowName" label="流程" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
              {{ row.status === 'success' ? '✅ 完成' : '❌ 失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="turns" label="对话轮次" width="100" />
        <el-table-column prop="files" label="产出文件" width="100" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const stats = ref({
  runCount: 0,
  successRate: 100,
  totalTurns: 0,
  outputFiles: 0,
})

const recentRuns = ref([])
</script>

<style scoped>
.dashboard {
  padding: 24px;
}

h1 {
  margin-bottom: 24px;
  color: #fff;
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
}

.recent-runs {
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
}
</style>
