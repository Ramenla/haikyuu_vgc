
# Laporan Analisis Efek Kartu Haikyuu VCG

- **Total Kartu di Database:** 52
- **Kartu Tanpa Efek ("Tidak ada efek"):** 21
- **Kartu Memiliki Efek Text:** 31
  - **Terimplementasi (Secara Data/Sistem):** 30
  - **Belum Terimplementasi (Kosong/Hanya Teks):** 1

## Daftar Kartu Belum Terimplementasi
- [ ] **HVD-05-002 - Kenma Kozume**: If this character is a Toss character and your Attack character has 3 or more Attack points written on it, you may choose a character card from that character's guts and put it into the Attack area.

## Daftar Kartu Terimplementasi (atau sebagian)
- [x] **HVD-01-001 - Shōyō Hinata**: Generic (onPlayAttack -> addPower)
- [x] **HVD-01-002 - Tobio Kageyama**: Generic (onPlayToss -> drawCard)
- [x] **HVD-01-006 - Kei Tsukishima**: Generic (onPlayBlock -> addPower)
- [x] **HVD-01-008 - Chikara Ennoshita**: Generic (onHandActivate -> buffDefense)
- [x] **HVD-01-009 - Dead On!!**: Generic (onPlayEvent -> actionDeadOn)
- [x] **HVD-01-010 - We're counting on you**: Generic (onPlayEvent -> actionCountingOnYou)
- [x] **HVD-02-001 - Tetsurō Kuroo**: Generic (onPlayAttack -> addPower)
- [x] **HVD-02-002 - Kenma Kozume**: Generic (onPlayAttack -> actionKenmaToss)
- [x] **HVD-02-006 - This is what it means to connect**: Generic (onPlayEvent -> actionNekomaReceive)
- [x] **HVD-02-007 - Tōru Oikawa**: Generic (onPlayToss -> actionOikawaToss)
- [x] **HVD-02-009 - Yūtarō Kindaichi**: Generic (onPlayReceive -> addPower)
- [x] **HVD-02-012 - Doesn't it make sense to connect to that attack?**: Generic (onPlayEvent -> actionOikawaEvent)
- [x] **HVD-03-001 - Shōyō Hinata**: Generic (onPlayAttack -> addPowerIfGuts)
- [x] **HVD-03-002 - Tobio Kageyama**: Generic (onPlayToss -> addPowerIfGuts)
- [x] **HVD-03-003 - Daichi Sawamura**: Generic (onPlayReceive -> drawCard)
- [x] **HVD-03-008 - Asahi Azumane**: Generic (onPlayBlock -> drawCard)
- [x] **HVD-03-009 - Dead On!!**: Generic (onPlayEvent -> actionDeadOnHVD03)
- [x] **HVD-03-010 - I'll Go Ahead**: Generic (onPlayEvent -> actionIllGoAhead)
- [x] **HVD-04-001 - Tōru Oikawa**: Generic (onPlayAny -> oikawaHVD04)
- [x] **HVD-04-002 - Hajime Iwaizumi**: Generic (onPlayAttack -> iwaizumiHVD04)
- [x] **HVD-04-007 - Akira Kunimi**: Generic (onPlayReceive -> kunimiHVD04)
- [x] **HVD-04-008 - Shinji Watari**: Generic (onPlayReceiveOrToss -> drawCardIfGuts)
- [x] **HVD-04-009 - It's all right**: Generic (onPlayEvent -> actionItsAllRight)
- [x] **HVD-04-010 - I believe in you guys**: Generic (onPlayEvent -> actionIBelieveInYouGuys)
- [x] **HVD-05-001 - Tetsurō Kuroo**: Generic (onPlayBlock -> kurooHVD05)
- [x] **HVD-05-003 - Lev Haiba**: Generic (onPlayAttack -> levHVD05)
- [x] **HVD-05-005 - Get it! I have to stop it, get it!**: Generic (onPlayEvent -> actionGetIt)
- [x] **HVD-05-006 - Kōtarō Bokuto**: Generic (onPlayAny -> bokutoHVD05)
- [x] **HVD-05-007 - Keiji Akaashi**: Generic (onPlayToss -> akaashiHVD05)
- [x] **HVD-05-010 - After all, I'm the strongest**: Generic (onPlayEvent -> actionAfterAll)
