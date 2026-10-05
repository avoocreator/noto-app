#!/bin/bash
# Task 11 — sinkronkan project → staging (scripts/stage/noto) → rebuild zip
# Aturan exclude = isi zip v2 lama (tanpa node_modules/.next/out/build artifacts,
# tanpa file environment, tanpa worklog internal).
set -e
cd /home/z/my-project

STAGE=scripts/stage/noto

rsync -rc --delete \
  --exclude node_modules --exclude .next --exclude out --exclude db --exclude .git \
  --exclude .claude --exclude .z-ai-config --exclude "*.log" --exclude dev.db \
  --exclude "scripts/stage" --exclude "scripts/noto-guide-raw.pdf" --exclude "scripts/noto-guide.html" \
  --exclude "android/app/build" --exclude "android/.gradle" --exclude "android/build" \
  --exclude "android/local.properties" --exclude "android/app/src/main/assets/public" \
  --exclude "android/app/src/main/assets/capacitor.config.json" \
  --exclude "android/capacitor-cordova-android-plugins" \
  --exclude upload --exclude download --exclude examples --exclude tests --exclude skills \
  --exclude prisma --exclude "panduan.md" --exclude Caddyfile \
  --exclude ".env" --exclude ".env.*" \
  --exclude ".initial_snapshot.json" --exclude ".pending_clone.json" \
  --exclude "next-env.d.ts" --exclude "tsconfig.tsbuildinfo" \
  --exclude "worklog.md" --exclude ".zscripts" --exclude "mini-services" \
  --exclude "scripts/process-logo.py" --exclude "scripts/render-pages.py" \
  --exclude "scripts/stamp-pages.py" --exclude "scripts/test-supabase.ts" \
  ./ "$STAGE/"

echo "--- Staging disinkron. Rebuild zip ---"
cd "$STAGE"
rm -f /home/z/my-project/download/noto-source-code.zip
zip -rq /home/z/my-project/download/noto-source-code.zip . -x ".*-profile"
cd /home/z/my-project
unzip -l download/noto-source-code.zip | tail -2
echo "--- Verifikasi file kunci di zip ---"
unzip -l download/noto-source-code.zip | grep -E "notif.ts|widget_noto.xml|NotoWidgetProvider|capacitor.plugins|use-reminders|dashboard.tsx|notes.tsx|settings.tsx|PANDUAN.md|bun.lock|package.json|config.xml|splash.png" | awk '{print $4}'
