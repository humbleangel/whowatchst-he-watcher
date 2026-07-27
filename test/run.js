let totalPassed = 0
let totalFailed = 0

const tests = [
  require('./test-ignore'),
  require('./test-scanner'),
  require('./test-store'),
  require('./test-llm'),
  require('./test-pipeline'),
  require('./test-api')
];

(async () => {
  console.log('\n=== W.W.S.W. Test Suite ===\n')

  for (const t of tests) {
    const name = Object.keys(require.cache).find(k => k.includes(t.id)) || 'unknown'
    console.log(`\n${name.split('\\').pop() || name.split('/').pop()}:`)

    if (t.run) {
      try {
        await t.run()
      } catch (e) {
        console.log(`  ✗ suite error: ${e.message}`)
      }
    }

    const c = t.count()
    totalPassed += c.passed
    totalFailed += c.failed
  }

  console.log(`\n=== Results: ${totalPassed} passed, ${totalFailed} failed ===\n`)
  process.exit(totalFailed > 0 ? 1 : 0)
})()
