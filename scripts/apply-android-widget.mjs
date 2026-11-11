// Menyalin berkas widget native ke proyek Android hasil `cap add android`, lalu menambal manifest.
// Aman dijalankan berulang (idempoten). Dipanggil otomatis oleh `npm run cap:sync`.
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const src = join(root, 'native', 'android-widget');
const app = join(root, 'android', 'app', 'src', 'main');
if (!existsSync(app)) {
  console.error('Folder android/ belum ada. Jalankan dulu: npm run cap:add');
  process.exit(1);
}

// 1) paket Java: app.noto.mobile (sesuai appId di capacitor.config.ts)
const javaDir = join(app, 'java', 'app', 'noto', 'mobile');
mkdirSync(javaDir, { recursive: true });
cpSync(join(src, 'java', 'app', 'noto', 'mobile'), javaDir, { recursive: true });

// 2) resource: layout, drawable, xml, ikon, pratinjau widget
cpSync(join(src, 'res'), join(app, 'res'), { recursive: true });

// 3) manifest: receiver widget + intent-filter noto:// + izin notifikasi
const mf = join(app, 'AndroidManifest.xml');
let x = readFileSync(mf, 'utf8');
if (!x.includes('NotoWidgetProvider')) {
  const receiver = `
        <receiver android:name=".NotoWidgetProvider" android:exported="true">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_noto_info" />
        </receiver>
`;
  x = x.replace('</application>', receiver + '    </application>');
}
if (!x.includes('android:scheme="noto"')) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="noto" />
            </intent-filter>
`;
  x = x.replace(/(<activity[\s\S]*?)(<\/activity>)/, (_m, a, b) => a + filter + '        ' + b);
}
for (const perm of ['android.permission.POST_NOTIFICATIONS', 'android.permission.SCHEDULE_EXACT_ALARM']) {
  if (!x.includes(perm)) x = x.replace('<application', `<uses-permission android:name="${perm}" />\n    <application`);
}
writeFileSync(mf, x);
console.log('Widget Noto terpasang di proyek Android.');
