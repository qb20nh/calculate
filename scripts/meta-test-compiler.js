import { execSync } from 'node:child_process'
import process from 'node:process'

function runVitest(skipCompiler) {
  console.log(
    `🚀 Running tests ${skipCompiler ? 'WITHOUT' : 'WITH'} React Compiler...`
  )
  try {
    // We use pnpm vitest to ensure we use the local version.
    // We explicitly disable coverage to avoid generating coverage files.
    // We use --reporter=json to get results via stdout.
    const output = execSync(
      'pnpm vitest run --reporter=json --coverage=false',
      {
        stdio: ['ignore', 'pipe', 'inherit'],
        env: {
          ...process.env,
          SKIP_COMPILER: String(skipCompiler)
        }
      }
    )
    return JSON.parse(output.toString())
  } catch (error) {
    // Vitest returns non-zero if tests fail, which is fine, we want to compare results.
    // The JSON output should be in error.stdout.
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString())
      } catch (parseError) {
        console.error(
          `❌ Failed to parse Vitest JSON output: ${parseError.message}`
        )
        throw error
      }
    }
    console.error(`⚠️  Vitest finished with an error: ${error.message}`)
    throw error
  }
}

async function main() {
  try {
    // 1. Run tests with compiler
    const withResults = runVitest(false)

    // 2. Run tests without compiler
    const withoutResults = runVitest(true)

    // 3. Compare
    console.log('\n📊 Comparison Results:')
    console.log('----------------------------')
    console.log(
      `Tests Total:   With=${withResults.numTotalTests.toString().padStart(3)} | Without=${withoutResults.numTotalTests.toString().padStart(3)}`
    )
    console.log(
      `Tests Passed:  With=${withResults.numPassedTests.toString().padStart(3)} | Without=${withoutResults.numPassedTests.toString().padStart(3)}`
    )
    console.log(
      `Tests Failed:  With=${withResults.numFailedTests.toString().padStart(3)} | Without=${withoutResults.numFailedTests.toString().padStart(3)}`
    )
    console.log('----------------------------')

    const discrepancies = []

    if (withResults.numPassedTests !== withoutResults.numPassedTests) {
      discrepancies.push('❌ Number of passed tests differs!')
    }

    if (withResults.numFailedTests !== withoutResults.numFailedTests) {
      discrepancies.push('❌ Number of failed tests differs!')
    }

    // Deep compare failed test names if counts match but results might differ
    const getFailedNames = (results) =>
      results.testResults
        .flatMap((tr) => tr.assertionResults)
        .filter((ar) => ar.status === 'failed')
        .map((ar) => ar.fullName)
        .sort()

    const withFailed = getFailedNames(withResults)
    const withoutFailed = getFailedNames(withoutResults)

    if (JSON.stringify(withFailed) !== JSON.stringify(withoutFailed)) {
      discrepancies.push('❌ The specific tests that failed are different!')
      console.log('\nFailed with compiler:', withFailed)
      console.log('Failed without compiler:', withoutFailed)
    }

    if (discrepancies.length === 0) {
      console.log(
        '\n✅ SUCCESS: The React Compiler does not affect test outcomes.'
      )
      process.exit(0)
    } else {
      console.log('\n🛑 FAILURE: Discrepancies detected!')
      discrepancies.forEach((d) => console.log(d))
      process.exit(1)
    }
  } catch (error) {
    console.error('\n💥 Error running meta-test:', error)
    process.exit(1)
  }
}

await main()
