export const WORLD_MAP_SIZE = 1024;

export const WORLD_MAP_LOCATIONS = [
  {
    id: "eldoria",
    name: "Королевство Эльдория",
    category: "power",
    categoryLabel: "Великая держава",
    defaultVisibility: "known",
    x: 50,
    y: 40,
    description: "Столица и культурный центр. Держава, диктующая моду и законы благодаря огромным богатствам."
  },
  {
    id: "ostelm",
    name: "Северная держава Остельм",
    category: "power",
    categoryLabel: "Великая держава",
    defaultVisibility: "known",
    x: 50,
    y: 13,
    description: "Военный противовес югу. Суровое государство с мощной пехотой."
  },
  {
    id: "valleria",
    name: "Княжество Валлерия",
    category: "power",
    categoryLabel: "Великая держава",
    defaultVisibility: "known",
    x: 72,
    y: 37,
    description: "Степной и долинный край. Поставщик лучшей кавалерии и коней для всех союзов."
  },
  {
    id: "mirtengard",
    name: "Миртенгард",
    category: "power",
    categoryLabel: "Крепость-государство",
    defaultVisibility: "known",
    x: 42,
    y: 29,
    description: "Независимый город-бастион, контролирующий ключевой горный проход."
  },
  {
    id: "verdict",
    name: "Город-суд Вердикт",
    category: "city",
    categoryLabel: "Независимый город",
    defaultVisibility: "known",
    x: 61,
    y: 64,
    description: "Нейтральная территория. Место дипломатии, высшего правосудия и заключения мировых трактатов."
  },
  {
    id: "brigport",
    name: "Вольный порт Бригпорт",
    category: "city",
    categoryLabel: "Торговый хаб",
    defaultVisibility: "known",
    x: 71,
    y: 75,
    description: "Крупнейший торговый хаб. Здесь сходятся морские пути и оседает золото всех купцов."
  },
  {
    id: "callista",
    name: "Торговый узел Каллиста",
    category: "city",
    categoryLabel: "Пустынный узел",
    defaultVisibility: "known",
    x: 62,
    y: 30,
    description: "Единственный путь через пустыню. Контролирует поставки драгоценного шелка."
  },
  {
    id: "arkheim",
    name: "Цитадель Аркхейм",
    category: "city",
    categoryLabel: "Архивный центр",
    defaultVisibility: "known",
    x: 86,
    y: 12,
    description: "Неприступный научный или архивный центр на скалах, защищённый своей труднодоступностью."
  },
  {
    id: "apple-ford",
    name: "Яблоневый брод",
    category: "resource",
    categoryLabel: "Провинция",
    defaultVisibility: "known",
    x: 45,
    y: 57,
    description: "Сельскохозяйственный центр, поставляющий провизию в центральные регионы."
  },
  {
    id: "hop-marks",
    name: "Хмельные вешки",
    category: "resource",
    categoryLabel: "Провинция",
    defaultVisibility: "known",
    x: 24,
    y: 39,
    description: "Деревня-монополист в производстве напитков, обеспечивающая трактиры всей страны."
  },
  {
    id: "stone-bowl",
    name: "Каменная чаша",
    category: "resource",
    categoryLabel: "Горное поселение",
    defaultVisibility: "known",
    x: 38,
    y: 83,
    description: "Горное поселение. Добыча редких минералов или геотермальное фермерство в кратере."
  },
  {
    id: "crooked-wood",
    name: "Криволесье",
    category: "resource",
    categoryLabel: "Пограничный пост",
    defaultVisibility: "known",
    x: 23,
    y: 24,
    description: "Лесозаготовки и пограничный пост на границе с неосвоенными землями."
  },
  {
    id: "ephyria",
    name: "Облачные острова Эфирия",
    category: "anomaly",
    categoryLabel: "Аномальная зона",
    defaultVisibility: "hidden",
    x: 91,
    y: 20,
    description: "Высокогорная или парящая обитель, живущая в изоляции от земных проблем."
  },
  {
    id: "tenebris",
    name: "Мёртвое королевство Тенебрис",
    category: "anomaly",
    categoryLabel: "Опасная пустошь",
    defaultVisibility: "hidden",
    x: 22,
    y: 57,
    description: "Бывшее государство, ставшее опасной пустошью и буферной зоной."
  },
  {
    id: "rift",
    name: "Разлом",
    category: "anomaly",
    categoryLabel: "Каньон",
    defaultVisibility: "hidden",
    x: 15,
    y: 77,
    description: "Город-шахта или город-тюрьма в каньоне, живущий по своим суровым правилам."
  },
  {
    id: "reed-whisper",
    name: "Шёпот камышей",
    category: "anomaly",
    categoryLabel: "Глухая окраина",
    defaultVisibility: "hidden",
    x: 86,
    y: 52,
    description: "Деревня, о существовании которой короли в Эльдории даже не подозревают."
  }
];

export const WORLD_MAP_CATEGORY_LABELS = {
  all: "Все",
  power: "Державы",
  city: "Города",
  resource: "Ресурсы",
  anomaly: "Аномалии"
};
