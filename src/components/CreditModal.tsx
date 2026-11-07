import React from 'react';
import { Award, ExternalLink, X, FileText, GitBranch } from 'lucide-react';
import styles from './CreditModal.module.css';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOpenRawCredit = () => {
    window.open('/credit.md', '_blank');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Award size={20} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>
                Penghargaan &amp; Kredit Pengembang
              </h3>
              <p className={styles.headerSubtitle}>
                // CHEAT CLIP PRO ACKNOWLEDGMENTS &amp; TRIBUTE
              </p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.rawBtn}
              onClick={handleOpenRawCredit}
              title="Buka berkas credit.md mentah di tab baru"
            >
              <FileText size={12} />
              <span>credit.md</span>
              <ExternalLink size={10} />
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              title="Tutup (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className={styles.body}>
          <div className={styles.introBox}>
            Dokumen ini didedikasikan sebagai bentuk apresiasi, rasa syukur, dan penghormatan setinggi-tingginya kepada seluruh entitas, teknologi, musik pelarian, dan komunitas yang menemani malam-malam panjang selama perancangan serta eksekusi proyek <strong>Cheat Clip PRO</strong>.
          </div>

          {/* 1. Rasa Syukur Tertinggi */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>🤲 1. Rasa Syukur Tertinggi</span>
            </div>
            <div className={`${styles.itemCard} ${styles.featured}`}>
              <span className={styles.itemTitle}>Allah SWT</span> — Segala puji dan syukur atas kelimpahan akal, kesehatan, kesabaran, daya tahan mental saat debugging error tak berujung, serta ilham solusi di tengah kebuntuan kompilasi biner. Tanpa izin-Nya, baris kode ini tidak akan pernah selesai.
            </div>
          </div>

          {/* 2. Studio & Bendera Perjuangan */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>🏢 2. Studio &amp; Bendera Perjuangan</span>
            </div>
            <div className={styles.itemCard}>
              <span className={styles.itemTitle}>BRKH Studio</span> — Rumah dan wadah kreatif independen tempat ide-ide liar diracik menjadi produk nyata. Bukti bahwa proyek solo developer lokal mampu bersaing dan menghadirkan solusi teknologi mandiri tanpa ketergantungan biaya langganan SaaS yang mahal.
            </div>
          </div>

          {/* 3. Karakter Panutan & Mentalitas Kultivasi */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>⚡ 3. Karakter Panutan &amp; Mentalitas Kultivasi (Anime &amp; Donghua MCs)</span>
            </div>
            <p className={styles.sectionDesc}>
              Figur-figur fiktif dengan tekad sekeras baja (<em>dao heart</em>) yang menginspirasi mentalitas pantang menyerah saat proyek terasa mustahil diselesaikan sendirian:
            </p>
            <div className={styles.itemList}>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Naruto Uzumaki (Naruto)</span> — Simbol tekad api (<em>Nindo</em>) jalan ninja sejati. Mengajarkan untuk tidak pernah menarik kembali kata-kata dan pantang menyerah meski diremehkan atau dianggap bukan siapa-siapa di awal perjalanan.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Wang Lin (Renegade Immortal / Xian Ni)</span> — Kultivator dengan tekad membalikkan surga. Mengajarkan kegigihan tanpa kompromi, ketabahan melewati derita panjang, dan keberanian membantai ribuan bug/error demi mencapai puncak pemahaman sistem mandiri.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Shi Hao / Huang Tian Di (Perfect World)</span> — Solo dev sejati versi dunia kultivasi. Bertarung sendirian melintasi era tanpa akhir, menanggung beban langit dan bumi, serta menciptakan jalannya sendiri di tengah kesendirian.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Xiao Yan (Battle Through the Heavens / Doupo Cangqiong)</span> — Dari titik terendah saat dipandang sebelah mata, bangkit menelan satu per satu api surgawi (tantangan arsitektur kompleks) hingga dinobatkan menjadi Kaisar Api yang disegani. Tiga puluh tahun di timur sungai, tiga puluh tahun di barat sungai!
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Xu Qing (Beyond the Timescape / Guang Yin Zhi Wai)</span> — Ketenangan, insting bertahan hidup, dan kalkulasi dingin di dunia yang keras. Mengajarkan ketelitian membersihkan racun sistem (memory leak dan deadlocks) dengan fokus tajam tanpa banyak bicara.
              </div>
            </div>
          </div>

          {/* 4. AI Co-Pilots & Autonomous Partners */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>🤖 4. AI Co-Pilots &amp; Autonomous Engineering Partners</span>
            </div>
            <p className={styles.sectionDesc}>
              Deretan kecerdasan buatan yang bertindak sebagai "rekan kerja virtual", reviewer kode tanpa lelah, dan sparing partner diskusi arsitektur tingkat lanjut:
            </p>
            <div className={styles.itemList}>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Google Gemini &amp; Gemini Flash Models</span> — Motor penggerak inferensi analisis viralitas, pembaca alur transkrip cerdas, dan mitigasi batasan kuota lewat multi-key rotator.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Google Antigravity</span> — Lingkungan autonomous coding agent yang membantu navigasi refaktorisasi file, closed-loop verification, dan disiplin arsitektur.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Claude (Anthropic)</span> — Analis logika dan tata bahasa kode yang tajam dalam membedah kontrak data dan perancangan dokumen.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>ChatGPT (OpenAI)</span> — Teman brainstorming awal saat merumuskan ide dasar dari skrip CLI mentah hingga menjadi workflow terstruktur.
              </div>
            </div>
          </div>

          {/* 5. Bensin & Soundtrack Begadang */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>🎧 5. Bensin &amp; Soundtrack Begadang (Sonic Fuel)</span>
            </div>
            <p className={styles.sectionDesc}>
              Musik-musik yang memompa dopamin, memecah kantuk jam 3 pagi, dan menjaga ritme ketukan keyboard tetap beringas:
            </p>
            <div className={styles.itemList}>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Bring Me The Horizon (BMTH) &amp; Lorna Shore</span> — Distorsi breakdown brutal penembus kebuntuan logika FFmpeg dan C-extensions.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Avenged Sevenfold (A7X) &amp; Linkin Park</span> — Melodi nostalgia legendaris peneman refactoring ribuan baris TypeScript dan Python.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Yova Fvnky &amp; DJ Jedag Jedug BBHC (Breakbeat Hardcore)</span> — Bass boost ritmik berfrekuensi tinggi pemacu fokus speed-coding dan penyusunan komponen UI antarmuka visual neon.
              </div>
            </div>
          </div>

          {/* 6. Knowledge Hubs, Dokumentasi & Komunitas */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span>🌐 6. Knowledge Hubs, Dokumentasi &amp; Komunitas</span>
            </div>
            <p className={styles.sectionDesc}>
              Pondasi pengetahuan terbuka tempat seluruh kendala teknis menemukan jawabannya:
            </p>
            <div className={styles.itemList}>
              <div className={`${styles.itemCard} ${styles.repoHighlight}`}>
                <span className={styles.itemTitle}>Galih Juan Saputra</span> (
                <a
                  href="https://github.com/galihjuansaputra/cheat-clip-pro.git"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.repoLink}
                >
                  github.com/galihjuansaputra/cheat-clip-pro
                </a>
                ) — Kreator awal dan pemilik fondasi repositori orisinal Cheat Clip Pro. Apresiasi dan rasa hormat setinggi-tingginya atas inisiasi basis kode open-source yang menjadi pijakan fundamental bagi lahir dan berevolusinya Cheat Clip PRO.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Google.com &amp; YouTube.com</span> — Gerbang pencarian dokumentasi, tutorial teknis tersembunyi, dan sumber inspirasi konten kreator.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>GitHub.com</span> — Rumah bagi jutaan library open-source berlisensi MIT, komunitas global pengembang, dan infrastruktur versi kode.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Stack Overflow</span> — Penyelamat abadi dari error runtime PyInstaller, syntax ganjil, dan keanehan Windows path subprocess.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Reddit (r/selfhosted, r/Python, r/SideProject)</span> — Diskusi nyata seputar tools mandiri, optimasi sistem tanpa GPU server mahal, dan suara jujur para pengguna internet.
              </div>
              <div className={styles.itemCard}>
                <span className={styles.itemTitle}>Seluruh Komunitas Open-Source Dunia</span> — Pengembang yt-dlp, tim FFmpeg/LibASS, ekosistem React, FastAPI, dan Electron yang membuka akses teknologi secara cuma-cuma demi kemajuan bersama.
              </div>
            </div>
          </div>

          {/* Quote Card */}
          <div className={styles.quoteCard}>
            "Dari terminal CLI sederhana menjadi executable desktop mandiri — dibuat dengan kopi, distorsi musik keras, dan lisensi MIT untuk semua orang."
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <a
              href="https://github.com/galihjuansaputra/cheat-clip-pro.git"
              target="_blank"
              rel="noreferrer"
              className={styles.footerBtn}
            >
              <GitBranch size={13} />
              <span>Original Repo</span>
              <ExternalLink size={10} />
            </a>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={handleOpenRawCredit}
            >
              <FileText size={13} />
              <span>Buka credit.md</span>
            </button>
          </div>

          <button
            type="button"
            className={`${styles.footerBtn} ${styles.primary}`}
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
