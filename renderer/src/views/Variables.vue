<template>
  <div class="variables-page">
    <h1>📦 变量管理</h1>
    <div class="var-toolbar">
      <el-input v-model="searchText" placeholder="搜索变量..." clearable style="width:200px" />
      <el-select v-model="filterScope" placeholder="筛选作用域" clearable style="width:140px">
        <el-option label="输入" value="input" />
        <el-option label="运行时" value="runtime" />
        <el-option label="输出" value="output" />
        <el-option label="持久化" value="persistent" />
      </el-select>
      <el-button type="primary" @click="addVariable">➕ 新建变量</el-button>
      <el-button @click="refresh">🔄 刷新</el-button>
      <el-button @click="importVars">📥 导入</el-button>
      <el-button @click="exportVars">📤 导出</el-button>
    </div>
    <el-table :data="filteredVariables" stripe class="var-table" v-loading="loading" empty-text="暂无变量">
      <el-table-column prop="scope" label="作用域" width="100">
        <template #default="{ row }">
          <el-tag :type="scopeTagType(row.scope)" size="small">{{ scopeLabel(row.scope) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="200" sortable />
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="value" label="值" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="var-value">{{ truncateValue(row.value) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="editVariable(row)">✏️</el-button>
          <el-button size="small" type="danger" @click="deleteVariable(row)">🗑️</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" :title="isEditing ? '编辑变量' : '新建变量'" width="550px">
      <el-form label-position="top">
        <el-form-item label="变量名">
          <el-input v-model="editingVar.name" :disabled="isEditing" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editingVar.type">
            <el-option label="字符串 (string)" value="string" />
            <el-option label="数字 (number)" value="number" />
            <el-option label="布尔值 (boolean)" value="boolean" />
            <el-option label="数组 (array)" value="array" />
            <el-option label="对象 (object)" value="object" />
            <el-option label="文件路径 (file)" value="file" />
            <el-option label="代码 (code)" value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="editingVar.value" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="作用域">
          <el-radio-group v-model="editingVar.scope">
            <el-radio value="input">输入</el-radio>
            <el-radio value="runtime">运行时</el-radio>
            <el-radio value="output">输出</el-radio>
            <el-radio value="persistent">持久化</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveVariable">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const variables = ref([])
const loading = ref(false)
const searchText = ref('')
const filterScope = ref('')
const editDialogVisible = ref(false)
const isEditing = ref(false)
const editingVar = ref({ name: '', type: 'string', value: '', scope: 'input' })

const filteredVariables = computed(() => {
  return variables.value.filter(v => {
    if (searchText.value && !v.name.toLowerCase().includes(searchText.value.toLowerCase())) return false
    if (filterScope.value && v.scope !== filterScope.value) return false
    return true
  })
})

const scopeTagType = (scope) => ({
  input: '',
  runtime: 'warning',
  output: 'success',
  persistent: 'info',
}[scope] || '')

const scopeLabel = (scope) => ({
  input: '输入',
  runtime: '运行时',
  output: '输出',
  persistent: '持久化',
}[scope] || scope)

const truncateValue = (val) => {
  if (val === null || val === undefined) return '(空)'
  const str = typeof val === 'string' ? val : JSON.stringify(val)
  return str.length > 80 ? str.slice(0, 80) + '...' : str
}

const refresh = async () => {
  loading.value = true
  try {
    const data = await window.api.variable.list()
    variables.value = Array.isArray(data) ? data : Object.entries(data || {}).map(([name, config]) => ({
      name,
      ...config,
    }))
  } catch (e) {
    ElMessage.error(`加载变量失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

const addVariable = () => {
  isEditing.value = false
  editingVar.value = { name: '', type: 'string', value: '', scope: 'input' }
  editDialogVisible.value = true
}

const editVariable = (row) => {
  isEditing.value = true
  editingVar.value = { ...row }
  editDialogVisible.value = true
}

const saveVariable = async () => {
  if (!editingVar.value.name) {
    ElMessage.warning('变量名不能为空')
    return
  }
  try {
    await window.api.variable.set(
      editingVar.value.name,
      editingVar.value.value,
      editingVar.value.scope,
      editingVar.value.type
    )
    ElMessage.success('已保存')
    editDialogVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error(`保存失败: ${e.message}`)
  }
}

const deleteVariable = async (row) => {
  await ElMessageBox.confirm(`确定删除变量 "${row.name}"？`, '确认删除', { type: 'warning' })
  try {
    await window.api.variable.delete(row.name)
    ElMessage.success('已删除')
    await refresh()
  } catch (e) {
    ElMessage.error(`删除失败: ${e.message}`)
  }
}

const exportVars = async () => {
  try {
    const data = await window.api.variable.export()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `variables-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已导出')
  } catch (e) {
    ElMessage.error(`导出失败: ${e.message}`)
  }
}

const importVars = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await window.api.variable.import(data)
      ElMessage.success('已导入')
      await refresh()
    } catch (err) {
      ElMessage.error(`导入失败: ${err.message}`)
    }
  }
  input.click()
}

onMounted(refresh)
</script>

<style scoped>
.variables-page {
  padding: 24px;
}

h1 {
  color: #fff;
  margin-bottom: 24px;
}

.var-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.var-table {
  background: #1e1e2e;
}

.var-value {
  font-family: monospace;
  font-size: 12px;
  color: #aaa;
}
</style>
