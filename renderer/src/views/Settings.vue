<template>
  <div class="settings-page">
    <h1>⚙️ 设置</h1>

    <el-tabs v-model="activeTab" type="border-card" v-loading="loading">
      <!-- 浏览器 -->
      <el-tab-pane label="🌐 浏览器" name="browser">
        <el-form label-position="top" :model="settings.browser">
          <el-form-item label="AI 适配器">
            <el-select v-model="settings.browser.adapter" placeholder="选择 AI 平台">
              <el-option label="MiMo (小米)" value="mimo" />
              <el-option label="ChatGPT (OpenAI)" value="chatgpt" />
              <el-option label="DeepSeek" value="deepseek" />
              <el-option label="Kimi (月之暗面)" value="kimi" />
              <el-option label="通义千问 (阿里)" value="tongyi" />
              <el-option label="自定义..." value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标 URL">
            <el-input v-model="settings.browser.url" placeholder="https://platform.xiaomimimo.com" />
          </el-form-item>
          <el-form-item label="元素超时 (ms)">
            <el-input-number v-model="settings.browser.timeout" :min="5000" :max="300000" :step="1000" />
          </el-form-item>
          <el-form-item label="操作慢速 (ms)">
            <el-input-number v-model="settings.browser.slowMo" :min="0" :max="5000" :step="100" />
            <span class="form-hint">模拟人类操作速度，0 = 最快</span>
          </el-form-item>
          <el-form-item label="Cookie">
            <div class="cookie-status">
              <el-tag :type="settings.browser.cookieSaved ? 'success' : 'info'">
                {{ settings.browser.cookieSaved ? '✅ 已保存' : '❌ 未保存' }}
              </el-tag>
              <el-button size="small" @click="openBrowserLogin">🔑 打开浏览器登录</el-button>
              <el-button size="small" @click="saveCookie">💾 保存 Cookie</el-button>
              <el-button size="small" type="danger" @click="clearCookie">🗑️ 清除</el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 对话 -->
      <el-tab-pane label="💬 对话" name="conversation">
        <el-form label-position="top" :model="settings.conversation">
          <el-form-item label="消息间隔 (秒)">
            <el-row :gutter="12">
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.delayMin" :min="1" :max="60" />
              </el-col>
              <el-col :span="2" style="text-align:center; line-height:32px">到</el-col>
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.delayMax" :min="1" :max="120" />
              </el-col>
            </el-row>
            <span class="form-hint">两条消息之间的随机延迟</span>
          </el-form-item>
          <el-form-item label="发送前停顿 (秒)">
            <el-row :gutter="12">
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.pauseMin" :min="0" :max="30" />
              </el-col>
              <el-col :span="2" style="text-align:center; line-height:32px">到</el-col>
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.pauseMax" :min="0" :max="60" />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item label="打字速度 (ms/字符)">
            <el-row :gutter="12">
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.typingMin" :min="10" :max="500" />
              </el-col>
              <el-col :span="2" style="text-align:center; line-height:32px">到</el-col>
              <el-col :span="6">
                <el-input-number v-model="settings.conversation.typingMax" :min="10" :max="1000" />
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item label="回复超时 (秒)">
            <el-input-number v-model="settings.conversation.replyTimeout" :min="10" :max="600" />
          </el-form-item>
          <el-form-item label="流式输出检测">
            <el-switch v-model="settings.conversation.streamDetection" active-text="启用" />
            <span class="form-hint">等待 AI 打字完成后再继续</span>
          </el-form-item>
          <el-form-item label="回复检测策略">
            <el-select v-model="settings.conversation.detectStrategy">
              <el-option label="DOM 停止变化" value="dom-stable" />
              <el-option label="检测停止按钮消失" value="stop-button" />
              <el-option label="检测 loading 消失" value="loading" />
              <el-option label="自定义选择器" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="自定义回复检测选择器" v-if="settings.conversation.detectStrategy === 'custom'">
            <el-input v-model="settings.conversation.customSelector" placeholder=".reply-complete" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- GitHub -->
      <el-tab-pane label="🔄 GitHub" name="github">
        <el-form label-position="top" :model="settings.github">
          <el-form-item label="启用 GitHub 同步">
            <el-switch v-model="settings.github.enabled" />
          </el-form-item>
          <template v-if="settings.github.enabled">
            <el-form-item label="GitHub Token">
              <el-input v-model="settings.github.token" type="password" show-password placeholder="ghp_xxxxx" />
            </el-form-item>
            <el-form-item label="仓库">
              <el-input v-model="settings.github.repo" placeholder="username/mimo-bot-workspace" />
            </el-form-item>
            <el-form-item label="分支">
              <el-input v-model="settings.github.branch" placeholder="main" />
            </el-form-item>
            <el-form-item label="同步策略">
              <el-radio-group v-model="settings.github.strategy">
                <el-radio value="after-run">每次运行后</el-radio>
                <el-radio value="hourly">每小时</el-radio>
                <el-radio value="manual">手动</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="同步目录">
              <el-checkbox-group v-model="settings.github.syncDirs">
                <el-checkbox value="conversations">对话记录</el-checkbox>
                <el-checkbox value="projects">代码产出</el-checkbox>
                <el-checkbox value="flows">流程定义</el-checkbox>
                <el-checkbox value="data">抓取数据</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <el-button @click="testGitSync">🧪 测试同步</el-button>
              <el-button @click="checkGitStatus">📋 Git 状态</el-button>
            </el-form-item>
          </template>
        </el-form>
      </el-tab-pane>

      <!-- 通知 -->
      <el-tab-pane label="🔔 通知" name="notify">
        <el-form label-position="top" :model="settings.notify">
          <el-form-item label="运行完成">
            <el-checkbox v-model="settings.notify.desktopOnComplete">桌面通知</el-checkbox>
            <el-input v-model="settings.notify.webhookOnComplete" placeholder="Webhook URL (可选)" style="margin-top:8px" />
          </el-form-item>
          <el-form-item label="运行失败">
            <el-checkbox v-model="settings.notify.desktopOnFail">桌面通知</el-checkbox>
            <el-input v-model="settings.notify.webhookOnFail" placeholder="Webhook URL (可选)" style="margin-top:8px" />
          </el-form-item>
          <el-form-item label="需要人工介入">
            <el-checkbox v-model="settings.notify.desktopOnHandoff">桌面通知</el-checkbox>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 定时 -->
      <el-tab-pane label="⏰ 定时任务" name="schedule">
        <el-form label-position="top">
          <div v-for="(task, index) in settings.schedules" :key="index" class="schedule-item">
            <el-card shadow="hover">
              <el-row :gutter="12">
                <el-col :span="6">
                  <el-form-item label="流程">
                    <el-select v-model="task.flowId" placeholder="选择流程">
                      <el-option
                        v-for="flow in flowStore.flowList"
                        :key="flow.id"
                        :label="flow.name"
                        :value="flow.id"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="4">
                  <el-form-item label="频率">
                    <el-select v-model="task.frequency">
                      <el-option label="每天" value="daily" />
                      <el-option label="每小时" value="hourly" />
                      <el-option label="每周" value="weekly" />
                      <el-option label="自定义 Cron" value="cron" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="4">
                  <el-form-item label="时间">
                    <el-time-picker v-model="task.time" format="HH:mm" value-format="HH:mm" />
                  </el-form-item>
                </el-col>
                <el-col :span="4">
                  <el-form-item label="启用">
                    <el-switch v-model="task.enabled" />
                  </el-form-item>
                </el-col>
                <el-col :span="2">
                  <el-form-item label=" ">
                    <el-button type="danger" size="small" @click="removeSchedule(index)">🗑️</el-button>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="Cron 表达式" v-if="task.frequency === 'cron'">
                <el-input v-model="task.cron" placeholder="0 9 * * *" />
              </el-form-item>
            </el-card>
          </div>
          <el-button @click="addSchedule" style="margin-top:12px">➕ 添加定时任务</el-button>
        </el-form>
      </el-tab-pane>

      <!-- 扩展 -->
      <el-tab-pane label="🧩 扩展" name="extensions">
        <el-form label-position="top">
          <h3 style="color:#aaa; margin-bottom:12px">已安装扩展</h3>
          <el-table :data="settings.extensions" stripe v-loading="extLoading" empty-text="暂无扩展">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="toggleExtension(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="removeExtension(row)">🗑️</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top:12px">
            <el-button @click="installExtension">📂 从本地文件夹加载</el-button>
            <el-button @click="installCrx">📦 从 .crx 安装</el-button>
            <el-button @click="refreshExtensions">🔄 刷新</el-button>
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="settings-footer">
      <el-button type="primary" @click="saveSettings" :loading="saving">💾 保存所有设置</el-button>
      <el-button @click="resetSettings">🔄 恢复默认</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFlowStore } from '@/stores/flow'

const flowStore = useFlowStore()
const activeTab = ref('browser')
const loading = ref(false)
const saving = ref(false)
const extLoading = ref(false)

const settings = reactive({
  browser: {
    adapter: 'mimo',
    url: 'https://platform.xiaomimimo.com',
    timeout: 60000,
    slowMo: 500,
    cookieSaved: false,
  },
  conversation: {
    delayMin: 3,
    delayMax: 8,
    pauseMin: 1,
    pauseMax: 3,
    typingMin: 50,
    typingMax: 150,
    replyTimeout: 120,
    streamDetection: true,
    detectStrategy: 'dom-stable',
    customSelector: '',
  },
  github: {
    enabled: false,
    token: '',
    repo: '',
    branch: 'main',
    strategy: 'after-run',
    syncDirs: ['conversations', 'projects', 'flows'],
  },
  notify: {
    desktopOnComplete: true,
    desktopOnFail: true,
    desktopOnHandoff: true,
    webhookOnComplete: '',
    webhookOnFail: '',
  },
  schedules: [],
  extensions: [],
})

const loadSettings = async () => {
  loading.value = true
  try {
    const data = await window.api.settings.get()
    if (data) {
      if (data.browser) Object.assign(settings.browser, data.browser)
      if (data.conversation) Object.assign(settings.conversation, data.conversation)
      if (data.github) Object.assign(settings.github, data.github)
      if (data.notify) Object.assign(settings.notify, data.notify)
      if (data.schedules) settings.schedules = data.schedules
    }
  } catch (e) {
    console.error('Load settings error:', e)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    for (const [section, values] of Object.entries(settings)) {
      if (section !== 'extensions') {
        await window.api.settings.set(section, values)
      }
    }
    ElMessage.success('设置已保存')
  } catch (e) {
    ElMessage.error(`保存失败: ${e.message}`)
  } finally {
    saving.value = false
  }
}

const resetSettings = async () => {
  await ElMessageBox.confirm('确定恢复所有设置为默认值？', '确认', { type: 'warning' })
  try {
    await window.api.settings.reset()
    await loadSettings()
    ElMessage.info('已恢复默认设置')
  } catch (e) {
    ElMessage.error(`重置失败: ${e.message}`)
  }
}

const openBrowserLogin = async () => {
  try {
    await window.api.browser.open()
    ElMessage.info('浏览器已打开，请手动登录')
  } catch (e) {
    ElMessage.error(`打开浏览器失败: ${e.message}`)
  }
}

const saveCookie = async () => {
  try {
    await window.api.browser.saveCookie()
    settings.browser.cookieSaved = true
    ElMessage.success('Cookie 已保存')
  } catch (e) {
    ElMessage.error(`保存 Cookie 失败: ${e.message}`)
  }
}

const clearCookie = async () => {
  try {
    await window.api.browser.clearCookie()
    settings.browser.cookieSaved = false
    ElMessage.info('Cookie 已清除')
  } catch (e) {
    ElMessage.error(`清除 Cookie 失败: ${e.message}`)
  }
}

const testGitSync = async () => {
  try {
    const result = await window.api.git.sync({ dryRun: true })
    ElMessage.success(`同步测试成功: ${JSON.stringify(result)}`)
  } catch (e) {
    ElMessage.error(`同步测试失败: ${e.message}`)
  }
}

const checkGitStatus = async () => {
  try {
    const status = await window.api.git.status()
    ElMessage.info(JSON.stringify(status, null, 2))
  } catch (e) {
    ElMessage.error(`获取 Git 状态失败: ${e.message}`)
  }
}

const addSchedule = () => {
  settings.schedules.push({
    flowId: '',
    frequency: 'daily',
    time: '09:00',
    cron: '',
    enabled: true,
  })
}

const removeSchedule = (index) => {
  settings.schedules.splice(index, 1)
}

const refreshExtensions = async () => {
  extLoading.value = true
  try {
    const plugins = await window.api.plugin.list()
    settings.extensions = (plugins || []).map(p => ({
      name: p.manifest?.name || p.name,
      version: p.manifest?.version || '?',
      enabled: p.enabled !== false,
    }))
  } catch (e) {
    console.error('Load extensions error:', e)
  } finally {
    extLoading.value = false
  }
}

const toggleExtension = async (ext) => {
  try {
    if (ext.enabled) {
      await window.api.plugin.enable(ext.name)
    } else {
      await window.api.plugin.disable(ext.name)
    }
  } catch (e) {
    ElMessage.error(`操作失败: ${e.message}`)
    ext.enabled = !ext.enabled
  }
}

const removeExtension = async (ext) => {
  await ElMessageBox.confirm(`确定卸载扩展 "${ext.name}"？`, '确认卸载', { type: 'warning' })
  try {
    await window.api.plugin.uninstall(ext.name)
    await refreshExtensions()
    ElMessage.success('已卸载')
  } catch (e) {
    ElMessage.error(`卸载失败: ${e.message}`)
  }
}

const installExtension = () => {
  ElMessage.info('请选择包含 plugin.json 的文件夹')
  // Electron 中需要通过 dialog 选择文件夹，暂用提示
}

const installCrx = () => {
  ElMessage.info('请选择 .crx 文件')
}

onMounted(() => {
  loadSettings()
  refreshExtensions()
  flowStore.loadFlowList()
})
</script>

<style scoped>
.settings-page {
  padding: 24px;
}

h1 {
  color: #fff;
  margin-bottom: 24px;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.cookie-status {
  display: flex;
  gap: 8px;
  align-items: center;
}

.schedule-item {
  margin-bottom: 12px;
}

.settings-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #2a2a3e;
  display: flex;
  gap: 8px;
}
</style>
