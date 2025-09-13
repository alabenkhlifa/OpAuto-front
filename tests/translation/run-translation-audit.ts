#!/usr/bin/env node

/**
 * Translation Audit Runner
 * 
 * This script runs comprehensive translation tests across all OpAuto screens
 * and generates a detailed audit report as specified in ALA-5.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testFile: string;
  screen: string;
  passed: boolean;
  errors: string[];
  languages: Array<{
    language: string;
    passed: boolean;
    issues: string[];
  }>;
}

interface AuditReport {
  timestamp: string;
  totalScreens: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  languageResults: {
    english: { passed: number; failed: number; issues: string[] };
    french: { passed: number; failed: number; issues: string[] };
    arabic: { passed: number; failed: number; issues: string[] };
  };
  screenResults: TestResult[];
  summary: {
    completedScreens: string[];
    failedScreens: string[];
    criticalIssues: string[];
    recommendations: string[];
  };
}

const TEST_FILES = [
  'auth.spec.ts',
  'dashboard.spec.ts', 
  'cars.spec.ts',
  'maintenance.spec.ts',
  'customers.spec.ts',
  'inventory.spec.ts',
  'appointments.spec.ts',
  'invoicing.spec.ts',
  'employees.spec.ts',
  'reports.spec.ts',
  'settings.spec.ts',
  'profile.spec.ts'
];

const SCREEN_MAPPING = {
  'auth.spec.ts': 'Authentication & Access',
  'dashboard.spec.ts': 'Dashboard & Overview',
  'cars.spec.ts': 'Vehicle Management',
  'maintenance.spec.ts': 'Maintenance & Service',
  'customers.spec.ts': 'Customer Management',
  'inventory.spec.ts': 'Inventory Management',
  'appointments.spec.ts': 'Appointments & Scheduling',
  'invoicing.spec.ts': 'Invoicing & Billing',
  'employees.spec.ts': 'Employee Management',
  'reports.spec.ts': 'Reports & Analytics',
  'settings.spec.ts': 'Settings & Configuration',
  'profile.spec.ts': 'Profile Management'
};

class TranslationAuditRunner {
  private results: TestResult[] = [];

  async runAudit(): Promise<AuditReport> {
    console.log('🚀 Starting OpAuto Translation Audit (ALA-5)...\n');
    
    // Run each test file
    for (const testFile of TEST_FILES) {
      const testPath = path.join(__dirname, testFile);
      
      // Check if test file exists
      if (fs.existsSync(testPath)) {
        console.log(`📋 Running tests for ${SCREEN_MAPPING[testFile]}...`);
        const result = await this.runTestFile(testFile);
        this.results.push(result);
      } else {
        console.log(`⚠️  Test file ${testFile} not found - creating placeholder result`);
        this.results.push({
          testFile,
          screen: SCREEN_MAPPING[testFile],
          passed: false,
          errors: ['Test file not implemented yet'],
          languages: [
            { language: 'en', passed: false, issues: ['Test not implemented'] },
            { language: 'fr', passed: false, issues: ['Test not implemented'] },
            { language: 'ar', passed: false, issues: ['Test not implemented'] }
          ]
        });
      }
    }

    // Generate comprehensive report
    const report = this.generateReport();
    
    // Save report to file
    await this.saveReport(report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  private async runTestFile(testFile: string): Promise<TestResult> {
    return new Promise((resolve) => {
      const testPath = path.join(__dirname, testFile);
      const playwrightProcess = spawn('npx', ['playwright', 'test', testPath, '--reporter=json'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      playwrightProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      playwrightProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      playwrightProcess.on('close', (code) => {
        const result: TestResult = {
          testFile,
          screen: SCREEN_MAPPING[testFile],
          passed: code === 0,
          errors: code === 0 ? [] : [errorOutput || 'Test execution failed'],
          languages: [
            { language: 'en', passed: code === 0, issues: [] },
            { language: 'fr', passed: code === 0, issues: [] },
            { language: 'ar', passed: code === 0, issues: [] }
          ]
        };

        // Parse JSON output if available to get more detailed results
        try {
          if (output) {
            const jsonResult = JSON.parse(output);
            // Process detailed test results here if needed
          }
        } catch (e) {
          // JSON parsing failed, use basic result
        }

        resolve(result);
      });
    });
  }

  private generateReport(): AuditReport {
    const now = new Date();
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;

    // Calculate language-specific results
    const languageResults = {
      english: { passed: 0, failed: 0, issues: [] as string[] },
      french: { passed: 0, failed: 0, issues: [] as string[] },
      arabic: { passed: 0, failed: 0, issues: [] as string[] }
    };

    this.results.forEach(result => {
      result.languages.forEach(lang => {
        const langKey = lang.language === 'en' ? 'english' : 
                       lang.language === 'fr' ? 'french' : 'arabic';
        
        if (lang.passed) {
          languageResults[langKey].passed++;
        } else {
          languageResults[langKey].failed++;
          languageResults[langKey].issues.push(...lang.issues);
        }
      });
    });

    const completedScreens = this.results
      .filter(r => r.passed)
      .map(r => r.screen);

    const failedScreens = this.results
      .filter(r => !r.passed)
      .map(r => r.screen);

    const criticalIssues = this.results
      .filter(r => !r.passed)
      .flatMap(r => r.errors);

    const recommendations = this.generateRecommendations();

    return {
      timestamp: now.toISOString(),
      totalScreens: TEST_FILES.length,
      totalTests: this.results.length,
      passedTests,
      failedTests,
      languageResults,
      screenResults: this.results,
      summary: {
        completedScreens,
        failedScreens,
        criticalIssues,
        recommendations
      }
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Add recommendations based on failures
    const arabicIssues = this.results.some(r => 
      r.languages.find(l => l.language === 'ar' && !l.passed)
    );
    
    if (arabicIssues) {
      recommendations.push('Review Arabic text rendering and RTL layout implementation');
    }

    const frenchIssues = this.results.some(r => 
      r.languages.find(l => l.language === 'fr' && !l.passed)
    );
    
    if (frenchIssues) {
      recommendations.push('Complete French translation keys in i18n files');
    }

    if (this.results.some(r => !r.passed)) {
      recommendations.push('Implement missing translation tests for uncovered screens');
      recommendations.push('Add translation keys for any hardcoded text found');
      recommendations.push('Verify all form validation messages are translated');
    }

    return recommendations;
  }

  private async saveReport(report: AuditReport): Promise<void> {
    const reportDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Save JSON report
    const jsonReportPath = path.join(reportDir, 'translation-audit-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(reportDir, 'translation-audit-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`📊 Reports saved:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  private generateHtmlReport(report: AuditReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpAuto Translation Audit Report - ALA-5</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #6c757d; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .section { margin-bottom: 30px; }
        .screen-result { border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
        .screen-title { font-weight: bold; font-size: 1.2em; margin-bottom: 10px; }
        .language-results { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .language-badge { padding: 5px 10px; border-radius: 4px; text-align: center; font-weight: bold; }
        .language-pass { background: #d4edda; color: #155724; }
        .language-fail { background: #f8d7da; color: #721c24; }
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OpAuto Translation Audit Report</h1>
            <h2>ALA-5: Complete Screen & Modal Inventory</h2>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.totalScreens}</div>
                <div class="stat-label">Total Screens</div>
            </div>
            <div class="stat-card">
                <div class="stat-number ${report.passedTests > 0 ? 'passed' : 'failed'}">${report.passedTests}</div>
                <div class="stat-label">Passed Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number ${report.failedTests === 0 ? 'passed' : 'failed'}">${report.failedTests}</div>
                <div class="stat-label">Failed Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round((report.passedTests / report.totalTests) * 100)}%</div>
                <div class="stat-label">Completion Rate</div>
            </div>
        </div>

        <div class="section">
            <h3>Language Results</h3>
            <div class="language-results">
                <div class="language-badge ${report.languageResults.english.failed === 0 ? 'language-pass' : 'language-fail'}">
                    English: ${report.languageResults.english.passed}/${report.languageResults.english.passed + report.languageResults.english.failed}
                </div>
                <div class="language-badge ${report.languageResults.french.failed === 0 ? 'language-pass' : 'language-fail'}">
                    French: ${report.languageResults.french.passed}/${report.languageResults.french.passed + report.languageResults.french.failed}
                </div>
                <div class="language-badge ${report.languageResults.arabic.failed === 0 ? 'language-pass' : 'language-fail'}">
                    Arabic: ${report.languageResults.arabic.passed}/${report.languageResults.arabic.passed + report.languageResults.arabic.failed}
                </div>
            </div>
        </div>

        <div class="section">
            <h3>Screen Results</h3>
            ${report.screenResults.map(screen => `
                <div class="screen-result">
                    <div class="screen-title ${screen.passed ? 'passed' : 'failed'}">
                        ${screen.passed ? '✅' : '❌'} ${screen.screen}
                    </div>
                    ${screen.errors.length > 0 ? `
                        <div class="errors">
                            <strong>Errors:</strong>
                            <ul>
                                ${screen.errors.map(error => `<li>${error}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        ${report.summary.recommendations.length > 0 ? `
            <div class="section">
                <h3>Recommendations</h3>
                <ul>
                    ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  private printSummary(report: AuditReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 OPAUTO TRANSLATION AUDIT SUMMARY (ALA-5)');
    console.log('='.repeat(60));
    console.log(`📅 Generated: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`📋 Total Screens: ${report.totalScreens}`);
    console.log(`✅ Passed Tests: ${report.passedTests}`);
    console.log(`❌ Failed Tests: ${report.failedTests}`);
    console.log(`📈 Completion Rate: ${Math.round((report.passedTests / report.totalTests) * 100)}%`);
    
    console.log('\n🌐 Language Results:');
    console.log(`   English: ${report.languageResults.english.passed}/${report.languageResults.english.passed + report.languageResults.english.failed} passed`);
    console.log(`   French:  ${report.languageResults.french.passed}/${report.languageResults.french.passed + report.languageResults.french.failed} passed`);
    console.log(`   Arabic:  ${report.languageResults.arabic.passed}/${report.languageResults.arabic.passed + report.languageResults.arabic.failed} passed`);

    if (report.summary.completedScreens.length > 0) {
      console.log('\n✅ Completed Screens:');
      report.summary.completedScreens.forEach(screen => {
        console.log(`   • ${screen}`);
      });
    }

    if (report.summary.failedScreens.length > 0) {
      console.log('\n❌ Failed Screens:');
      report.summary.failedScreens.forEach(screen => {
        console.log(`   • ${screen}`);
      });
    }

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.summary.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (report.failedTests === 0) {
      console.log('🎉 ALL TRANSLATION TESTS PASSED! OpAuto is fully internationalized.');
    } else {
      console.log('⚠️  Some translation tests failed. Review the detailed report above.');
    }
    
    console.log('='.repeat(60) + '\n');
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  const runner = new TranslationAuditRunner();
  runner.runAudit().catch(console.error);
}

export { TranslationAuditRunner };