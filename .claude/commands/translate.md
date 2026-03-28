---
description: Add, sync, or fix translation keys across en.json, fr.json, and ar.json
---

Translation files: `src/assets/i18n/{en,fr,ar}.json`. Nested JSON, dot-path keys (e.g. `common.save`).

## What to do: $ARGUMENTS

If no specific task given, default to **sync check**.

---

## Mode 1: Add keys
When user says "add translation for X" or provides key + values:

1. Read all 3 files (only the relevant section, not the whole file)
2. Add the key to all 3 files in the same location
3. If user only provides English, translate to French and Arabic yourself
4. Validate JSON after each edit (the PostToolUse hook will do this automatically)

Format for adding:
```
Key: maintenance.status.waitingForParts
EN: Waiting for Parts
FR: En attente de pièces
AR: في انتظار القطع
```

## Mode 2: Sync check
Find structural mismatches between the 3 files:

```bash
cd /Users/alabenkhlifa/IdeaProjects/OpAuto-front && python3 -c "
import json

def get_keys(obj, prefix=''):
    keys = set()
    for k, v in obj.items():
        path = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            keys.update(get_keys(v, path))
        else:
            keys.add(path)
    return keys

en = get_keys(json.load(open('src/assets/i18n/en.json')))
fr = get_keys(json.load(open('src/assets/i18n/fr.json')))
ar = get_keys(json.load(open('src/assets/i18n/ar.json')))

missing_fr = sorted(en - fr)
missing_ar = sorted(en - ar)
extra_fr = sorted(fr - en)
extra_ar = sorted(ar - en)

if missing_fr: print(f'FR missing ({len(missing_fr)}):'); [print(f'  {k}') for k in missing_fr[:20]]
if missing_ar: print(f'AR missing ({len(missing_ar)}):'); [print(f'  {k}') for k in missing_ar[:20]]
if extra_fr: print(f'FR extra ({len(extra_fr)}):'); [print(f'  {k}') for k in extra_fr[:20]]
if extra_ar: print(f'AR extra ({len(extra_ar)}):'); [print(f'  {k}') for k in extra_ar[:20]]
if not any([missing_fr, missing_ar, extra_fr, extra_ar]): print('All 3 files in sync.')
"
```

Then present findings as a choice list:
1. Fix all missing keys (add translations)
2. Fix specific section only
3. Remove extra keys
4. Show full diff and decide

## Mode 3: Rename key
When user says "rename X to Y":
1. Update the key in all 3 files
2. Grep for the old key in `src/app/` to find usages
3. Update all component references

## Rules
- Always edit all 3 files together — never leave one out of sync
- Preserve existing structure and ordering
- Arabic text must be valid RTL content
- After edits, the PostToolUse JSON validation hook runs automatically
- Keep translations natural, not machine-literal (e.g. French "Enregistrer" not "Sauvegarder" for Save in a form context)
