<template>
  <div class="database-page">
    <h1>🗄️ 数据库管理</h1>

    <div class="db-toolbar">
      <el-select v-model="selectedTable" placeholder="选择数据表" @change="loadTable" style="width:200px">
        <el-option
          v-for="table in tables"
          :key="table"
          :label="table"
          :value="table"
        />
      </el-select>
      <el-button @click="refresh" :loading="loading">🔄 刷新</el-button>
      <el-button type="primary" @click="addRow" :disabled="!selectedTable">➕ 添加记录</el-button>
      <el-button @click="exportTable" :disabled="!rows.length">📤 导出 CSV</el-button>
      <el-button @click="importTable" :disabled="!selectedTable">📥 导入 CSV</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table :data="rows" stripe class="db-table" v-loading="loading" empty-text="暂无数据或未选择表">
      <el-table-column
        v-for="col in columns"
        :key="col"
        :prop="col"
        :label="col"
        :width="col === 'id' ? 80 : undefined"
        show-overflow-tooltip
      />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editRow(row)">✏️</el-button>
          <el-button size="small" type="danger" @click="deleteRow(row)">🗑️</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 抓取任务 -->
    <el-card class="scrape-tasks" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>🕷️ 抓取任务</span>
          <el-button size="small" type="primary" @click="addScrapeTask">➕ 新建</el-button>
        </div>
      </template>
      <el-table :data="scrapeTasks" stripe v-loading="scrapeLoading" empty-text="暂无抓取任务">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="url" label="目标 URL" show-overflow-tooltip />
        <el-table-column prop="cron" label="频率" width="120" />
        <el-table-column prop="enabled" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
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

    <!-- 编辑行对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑记录" width="600px">
      <el-form label-position="top">
        <el-form-item v-for="col in editableColumns" :key="col" :label="col">
          <el-input v-model="editingRow[col]" :type="col === 'content' ? 'textarea' : 'text'" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRow">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const tables = ref([])
const selectedTable = ref('')
const columns = ref([])
const rows = ref([])
const loading = ref(false)
const scrapeTasks = ref([])
const scrapeLoading = ref(false)
const editDialogVisible = ref(false)
const editingRow = ref({})
const editingRowId = ref(null)

const editableColumns = computed(() => columns.value.filter(c => c !== 'id'))

const loadTable = async () => {
  if (!selectedTable.value) return
  loading.value = true
  try {
    const data = await window.api.db.query(selectedTable.value, {})
    if (data && data.length > 0) {
      columns.value = Object.keys(data[0])
      rows.value = data
    } else {
      columns.value = []
      rows.value = []
    }
  } catch (e) {
    ElMessage.error(`加载表失败: ${e.message}`)
    rows.value = []
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  loading.value = true
  try {
    tables.value = await window.api.db.getTables() || []
    if (selectedTable.value) {
      await loadTable()
    }
  } catch (e) {
    ElMessage.error(`刷新失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

const addRow = () => {
  editingRowId.value = null
  editingRow.value = {}
  columns.value.forEach(c => { if (c !== 'id') editingRow.value[c] = '' })
  editDialogVisible.value = true
}

const editRow = (row) => {
  editingRowId.value = row.id
  editingRow.value = { ...row }
  editDialogVisible.value = true
}

const saveRow = async () => {
  try {
    const data = { ...editingRow.value }
    delete data.id
    if (editingRowId.value) {
      await window.api.db.update(selectedTable.value, editingRowId.value, data)
    } else {
      await window.api.db.insert(selectedTable.value, data)
    }
    ElMessage.success('已保存')
    editDialogVisible.value = false
    await loadTable()
  } catch (e) {
    ElMessage.error(`保存失败: ${e.message}`)
  }
}

const deleteRow = async (row) => {
  await ElMessageBox.confirm('确定删除这条记录？', '确认删除', { type: 'warning' })
  try {
    await window.api.db.delete(selectedTable.value, row.id)
    ElMessage.success('已删除')
    await loadTable()
  } catch (e) {
    ElMessage.error(`删除失败: ${e.message}`)
  }
}

const exportTable = () => {
  if (!rows.value.length) return
  const headers = columns.value
  const csv = [
    headers.join(','),
    ...rows.value.map(row => headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedTable.value}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出')
}

const importTable = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { ElMessage.warning('CSV 无数据'); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      let count = 0
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
        const row = {}
        headers.forEach((h, j) => { row[h] = values[j] || '' })
        await window.api.db.insert(selectedTable.value, row)
        count++
      }
      ElMessage.success(`已导入 ${count} 条记录`)
      await loadTable()
    } catch (err) {
      ElMessage.error(`导入失败: ${err.message}`)
    }
  }
  input.click()
}

// ---- 抓取任务 ----

const loadScrapeTasks = async () => {
  scrapeLoading.value = true
  try {
    scrapeTasks.value = await window.api.scraper.listTasks() || []
  } catch (e) {
    scrapeTasks.value = []
  } finally {
    scrapeLoading.value = false
  }
}

const addScrapeTask = () => {
  ElMessage.info('请在流程编辑器中创建 scrape 节点')
}

const runScrapeTask = async (task) => {
  try {
    await window.api.scraper.run(task)
    ElMessage.success('抓取任务已启动')
  } catch (e) {
    ElMessage.error(`运行失败: ${e.message}`)
  }
}

const deleteScrapeTask = async (task) => {
  await ElMessageBox.confirm('确定删除此抓取任务？', '确认删除', { type: 'warning' })
  try {
    await window.api.scraper.deleteTask(task.id || task.name)
    ElMessage.success('已删除')
    await loadScrapeTasks()
  } catch (e) {
    ElMessage.error(`删除失败: ${e.message}`)
  }
}

onMounted(() => {
  refresh()
  loadScrapeTasks()
})
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
  flex-wrap: wrap;
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
