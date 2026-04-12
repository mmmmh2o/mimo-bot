export default {
  async execute(data) {
    const seconds = data.seconds || 5
    await new Promise(resolve => setTimeout(resolve, seconds * 1000))
  }
}
