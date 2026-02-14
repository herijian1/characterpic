import { exec } from 'child_process'
import path from 'path'

// 获取绝对路径
const profilePath = path.resolve(process.cwd(), 'plugins/miao-plugin/resources/profile')

export class updateProfile extends plugin {
  constructor() {
    super({
      name: '何日见面板图库更新',
      dsc: '何日见面板图更新',
      event: 'message',
      priority: 1,
      rule: [
        {
          reg: '^#更新(面板图|图库|面板图库)$',
          fnc: 'updateProfile'
        },
        {
          reg: '^#强制更新(面板图|图库|面板图库)$',
          fnc: 'forceUpdateProfile'
        },
        {
          reg: '^#(面板图|图库|面板图库)更新日志$',
          fnc: 'updateLog'
        }
      ]
    })
  }

  async checkMaster(e) {
    if (!e.isMaster) {
      console.log(`[面板图更新] 无权限用户 ${e.user_id} 尝试执行命令`)
      e.reply('⚠去你丫的，什么人啊命令我！')
      return false
    }
    console.log(`[面板图更新] 主人 ${e.user_id} 执行命令: ${e.msg}`)
    return true
  }

  // 执行Git命令并处理结果
  async executeGitCommand(e, command, actionName, isForce = false) {
    return new Promise((resolve) => {
      console.log(`[面板图更新] 执行命令: ${command}`)

      exec(command, { cwd: profilePath }, (error, stdout, stderr) => {
        const output = stdout + stderr
        console.log(`[面板图更新] 命令输出:\n${output}`)

        const isUpToDate = /Already up to date|已经是最新的|Already up-to-date|up to date/i.test(output)

        //文件变动数量
        const filesChanged = output.match(/(\d+) files? changed/) || [0]
        const changedCount = parseInt(filesChanged[1]) || 0

        if (error) {
          const errorCode = `ERR_${error.code || 'GIT_FAILED'}`
          const errorMsg = `${actionName}失败！\nError: ${errorCode}\n详情: ${error.message || stderr || '未知错误'}\n可以尝试执行#强制更新面板图库`

          console.log(`[面板图更新] Error: ${errorMsg}`)
          e.reply(errorMsg)
          return resolve(false)
        }
        
        // 结果处理
        let resultMsg
        if (isUpToDate) {
          resultMsg = '图库已是最新，无需再次更新！'
          console.log('[面板图更新] 图库已是最新状态')
        } else if (changedCount > 0) {
          resultMsg = `${isForce ? '强制更新' : '更新'}成功，共更新了${changedCount}张图片！`
          console.log(`[面板图更新] 共${changedCount}个文件改动`)
        } else {
          resultMsg = `${isForce ? '强制更新' : '图库更新'}成功，无图片被更新，具体可通过#面板图更新日志 查看！`
          console.log('[面板图更新] 未检测到文件改动')
        }
        
        e.reply(resultMsg)
        console.log(`[面板图更新] 操作完成: ${resultMsg}`)
        resolve(true)
      })
    })
  }

  async getLog() {
    return new Promise((resolve) => {
      const cmd = 'git log -100 --pretty="%h||[%cd] %s" --date=format:"%F %T"'
      exec(cmd, { cwd: profilePath }, (error, stdout) => {
        if (error) return resolve(`面板图库更新日志查询失败！\nError：${error.message}`)
        
        const logAll = stdout.split("\n").filter(str => str.trim())
        if (!logAll.length) return resolve("面板图库暂无更新日志！")
        
        let log = []
        for (let str of logAll) {
          const splitStr = str.split("||")
          if (splitStr[1] && !splitStr[1].includes("Merge branch")) {
            log.push(splitStr[1])
          }
        }
        
        if (log.length <= 0) return resolve("")
        
        exec("git config -l", { cwd: profilePath }, (err, configStdout) => {
          let remoteUrl = ""
          if (!err) {
            const urlMatches = configStdout.match(/remote\..*?\.url=.+/g) || []
            for (const match of urlMatches) {
              const url = match.replace(/remote\..*?\.url=/g, "").replace(/\/\/([^@]+)@/, "//")
              remoteUrl = url
              break
            }
          }
          
          const msg = [`面板图库更新日志，共${log.length}条`, log.join("\n\n")]
          if (remoteUrl) msg.push(remoteUrl)
          resolve(Bot.makeForwardArray(msg))
        })
      })
    })
  }

  async updateLog(e) {
    if (!(await this.checkMaster(e))) return
    const log = await this.getLog()
    await e.reply(log)
  }

  // 更新
  async updateProfile(e) {
    if (!(await this.checkMaster(e))) return
    
    e.reply('开始更新面板图库...')
    console.log('[面板图更新] 更新图库')
    await this.executeGitCommand(e, 'git pull', '图库更新')
  }

  // 强制更新
  async forceUpdateProfile(e) {
    if (!(await this.checkMaster(e))) return
    
    e.reply('开始强制更新面板图库...')
    console.log('[面板图更新] 强制更新图库')
    const resetCmd = 'git checkout . && git clean -fd && git pull'
    await this.executeGitCommand(e, resetCmd, '强制更新', true)
  }
}
