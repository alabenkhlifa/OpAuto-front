#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * i18n parity checker — verifies en.json / fr.json / ar.json have the
 * same set of keys.
 *
 * Honors known divergences (Arabic uses singular keys per project memory
 * `pitfall_translations`: `feature` not `features`, `tier` not `tiers`,
 * `photo` not `photos`). These pairs are listed in `KNOWN_AR_SINGULARS`
 * and treated as equivalent during the diff.
 *
 * Exits 1 if drift is detected so it can wire into the pre-commit hook.
 *
 * Usage:
 *   node scripts/check-i18n-parity.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'assets', 'i18n');
const FILES = ['en.json', 'fr.json', 'ar.json'];

/**
 * Pairs that intentionally differ between Arabic and en/fr.
 * `[arKey, enFrKey]` — both forms are accepted as the "same" semantic key.
 */
const KNOWN_AR_SINGULARS = [
  ['feature', 'features'],
  ['photo', 'photos'],
  ['tier', 'tiers'],
];

function loadJson(file) {
  const fullPath = path.join(I18N_DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`  Failed to parse ${file}: ${err.message}`);
    process.exit(2);
  }
}

/**
 * Walks an object tree and returns a flat Set of dotted keys for every
 * leaf string value. Arrays are not expected in our locale files; if
 * they appear they're treated as opaque leaves (key recorded once).
 */
function collectKeys(obj, prefix = '', out = new Set()) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      collectKeys(v, next, out);
    } else {
      out.add(next);
    }
  }
  return out;
}

/**
 * Returns a Set of "logical" keys with the AR-singular substitution
 * collapsed to its plural form (so we compare against en/fr).
 */
function normalizeArKeys(keys) {
  return new Set(
    [...keys].map((k) => {
      let out = k;
      for (const [singular, plural] of KNOWN_AR_SINGULARS) {
        // Replace `.singular.` and `.singular` (terminal) → plural.
        out = out
          .replace(new RegExp(`\\.${singular}\\.`, 'g'), `.${plural}.`)
          .replace(new RegExp(`\\.${singular}$`), `.${plural}`)
          .replace(new RegExp(`^${singular}\\.`), `${plural}.`)
          .replace(new RegExp(`^${singular}$`), plural);
      }
      return out;
    }),
  );
}

function diff(a, b) {
  const inA = [];
  for (const k of a) if (!b.has(k)) inA.push(k);
  return inA.sort();
}

function main() {
  const data = {};
  for (const f of FILES) {
    data[f] = collectKeys(loadJson(f));
  }
  const en = data['en.json'];
  const fr = data['fr.json'];
  const arRaw = data['ar.json'];
  const ar = normalizeArKeys(arRaw);

  const issues = [];
  const enMissingInFr = diff(en, fr);
  const frMissingInEn = diff(fr, en);
  const enMissingInAr = diff(en, ar);
  const arMissingInEn = diff(ar, en);

  if (enMissingInFr.length) {
    issues.push({
      label: 'Keys present in en.json but missing from fr.json',
      keys: enMissingInFr,
    });
  }
  if (frMissingInEn.length) {
    issues.push({
      label: 'Keys present in fr.json but missing from en.json',
      keys: frMissingInEn,
    });
  }
  if (enMissingInAr.length) {
    issues.push({
      label: 'Keys present in en.json but missing from ar.json',
      keys: enMissingInAr,
    });
  }
  if (arMissingInEn.length) {
    issues.push({
      label: 'Keys present in ar.json but missing from en.json',
      keys: arMissingInEn,
    });
  }

  if (issues.length === 0) {
    console.log('i18n parity check: OK (en.json, fr.json, ar.json have identical key sets).');
    process.exit(0);
  }

  console.error('i18n parity check: drift detected\n');
  for (const issue of issues) {
    console.error(`  ${issue.label} (${issue.keys.length}):`);
    for (const k of issue.keys.slice(0, 50)) {
      console.error(`    - ${k}`);
    }
    if (issue.keys.length > 50) {
      console.error(`    ... and ${issue.keys.length - 50} more.`);
    }
    console.error('');
  }
  process.exit(1);
}

main();
