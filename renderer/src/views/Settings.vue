<template>
  <div class="settings-page">
    <h1>⚙️ 设置</h1>

    <el-tabs v-model="activeTab" type="border-card">
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
                      <el-option label="日常开发任务" value="flow-1" />
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
          <el-table :data="settings.extensions" stripe>
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="version" label="版本" width="80" />
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" />
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
          </div>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <div class="settings-footer">
      <el-button type="primary" @click="saveSettings">💾 保存所有设置</el-button>
      <el-button @click="resetSettings">🔄 恢复默认</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('browser')

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
  extensions: [
    { name: 'Tampermonkey', version: '5.0', enabled: true },
  ],
})

const openBrowserLogin = () => {
  // TODO: IPC 打开浏览器
}

const saveCookie = () => {
  // TODO: IPC 保存 Cookie
  settings.browser.cookieSaved = true
  ElMessage.success('Cookie 已保存')
}

const clearCookie = () => {
  settings.browser.cookieSaved = false
  ElMessage.info('Cookie 已清除')
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

const removeExtension = (ext) => {
  // TODO: 卸载扩展
}

const installExtension = () => {
  // TODO: 从本地加载扩展
}

const installCrx = () => {
  // TODO: 安装 .crx
}

const saveSettings = async () => {
  // TODO: IPC 保存设置
  ElMessage.success('设置已保存')
}

const resetSettings = () => {
  // TODO: 恢复默认
  ElMessage.info('已恢复默认设置')
}
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
}
</style>
