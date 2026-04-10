<template>
  <div class="variables-page">
    <h1>📦 变量管理</h1>
    <div class="var-toolbar">
      <el-button type="primary" @click="addVariable">➕ 新建变量</el-button>
      <el-button @click="importVars">📥 导入</el-button>
      <el-button @click="exportVars">📤 导出</el-button>
    </div>
    <el-table :data="variables" stripe class="var-table">
      <el-table-column prop="scope" label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="scopeTagType(row.scope)">{{ row.scope }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="200" />
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="value" label="值">
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
    <el-dialog v-model="editDialogVisible" title="编辑变量" width="500px">
      <el-form label-position="top">
        <el-form-item label="变量名">
          <el-input v-model="editingVar.name" />
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
import { ref } from 'vue'

const variables = ref([])
const editDialogVisible = ref(false)
const editingVar = ref({ name: '', type: 'string', value: '', scope: 'input' })

const scopeTagType = (scope) => ({
  input: '',
  runtime: 'warning',
  output: 'success',
  persistent: 'info',
}[scope] || '')

const truncateValue = (val) => {
  if (!val) return '(空)'
  const str = typeof val === 'string' ? val : JSON.stringify(val)
  return str.length > 80 ? str.slice(0, 80) + '...' : str
}

const addVariable = () => {
  editingVar.value = { name: '', type: 'string', value: '', scope: 'input' }
  editDialogVisible.value = true
}

const editVariable = (row) => {
  editingVar.value = { ...row }
  editDialogVisible.value = true
}

const saveVariable = () => {
  // TODO: 保存到 store / IPC
  editDialogVisible.value = false
}

const deleteVariable = (row) => {
  // TODO: 删除
}

const importVars = () => {
  // TODO: 从文件导入
}

const exportVars = () => {
  // TODO: 导出为 JSON/CSV
}
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
  margin-bottom: 16px;
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
