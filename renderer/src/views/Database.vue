<template>
  <div class="database-page">
    <h1>🗄️ 数据库管理</h1>

    <div class="db-toolbar">
      <el-select v-model="selectedTable" placeholder="选择数据表" @change="loadTable">
        <el-option
          v-for="table in tables"
          :key="table"
          :label="table"
          :value="table"
        />
      </el-select>
      <el-button @click="refresh">🔄 刷新</el-button>
      <el-button type="primary" @click="addRow">➕ 添加记录</el-button>
      <el-button @click="exportTable">📤 导出 CSV</el-button>
      <el-button @click="importTable">📥 导入 CSV</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table :data="rows" stripe class="db-table" v-if="rows.length">
      <el-table-column
        v-for="col in columns"
        :key="col"
        :prop="col"
        :label="col"
        :width="col === 'id' ? 80 : undefined"
      />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editRow(row)">✏️</el-button>
          <el-button size="small" type="danger" @click="deleteRow(row)">🗑️</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-else description="暂无数据或未选择表" />

    <!-- 抓取任务 -->
    <el-card class="scrape-tasks" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>🕷️ 抓取任务</span>
          <el-button size="small" type="primary" @click="addScrapeTask">➕ 新建</el-button>
        </div>
      </template>
      <el-table :data="scrapeTasks" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="url" label="目标 URL" />
        <el-table-column prop="frequency" label="频率" />
        <el-table-column prop="enabled" label="状态" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="runScrapeTask(row)">▶ 运行</el-button>
            <el-button size="small" type="danger" @click="deleteScrapeTask(row)">🗑️</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const tables = ref(['scraped_data', 'conversations', 'variables', 'projects'])
const selectedTable = ref('')
const columns = ref([])
const rows = ref([])
const scrapeTasks = ref([])

const loadTable = async () => {
  // TODO: 通过 IPC 查询数据库
}

const refresh = () => loadTable()
const addRow = () => {}
const editRow = () => {}
const deleteRow = () => {}
const exportTable = () => {}
const importTable = () => {}
const addScrapeTask = () => {}
const runScrapeTask = () => {}
const deleteScrapeTask = () => {}
</script>

<style scoped>
.database-page {
  padding: 24px;
}

h1 {
  color: #fff;
  margin-bottom: 24px;
}

.db-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.db-table {
  margin-bottom: 24px;
}

.scrape-tasks {
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
