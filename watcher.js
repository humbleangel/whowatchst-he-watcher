class Watcher {
  constructor(rootPath, intervalMs, onTick) {
    this.rootPath = rootPath
    this.intervalMs = intervalMs
    this.onTick = onTick
    this.timer = null
    this.isBusy = false
    this.started = false
    this.lastCycle = null
    this.lastError = null
  }

  start() {
    this.started = true
    this.tick()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop() {
    this.started = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async tick() {
    if (this.isBusy) return
    this.isBusy = true
    try {
      const result = await this.onTick()
      this.lastCycle = new Date().toISOString()
      this.lastError = null
    } catch (err) {
      this.lastError = err.message
    } finally {
      this.isBusy = false
    }
  }

  getStatus() {
    return {
      watching: this.rootPath,
      interval: this.intervalMs,
      isRunning: this.started,
      isBusy: this.isBusy,
      lastCycle: this.lastCycle,
      lastError: this.lastError
    }
  }
}

module.exports = Watcher
