import React, { useMemo, useState } from "react";
import {
  Backpack,
  BookOpen,
  Coins,
  Eye,
  Shield,
  Sparkles,
  Swords,
  UserRound,
  WandSparkles
} from "lucide-react";

const VIEWS = [
  { key: "profile", label: "Персонаж", icon: UserRound },
  { key: "inventory", label: "Инвентарь", icon: Backpack },
  { key: "bestiary", label: "Бестиарий", icon: BookOpen },
  { key: "shop", label: "Лавка", icon: Coins }
];

const PARTY = [
  { id: "20", name: "Dri", role: "Маг ветра", state: "В строю", accent: "moss" },
  { id: "21", name: "Asa", role: "Следопыт", state: "На задании", accent: "gold" },
  { id: "22", name: "Morn", role: "Танк", state: "Отдыхает", accent: "ink" }
];

const LOADOUT = [
  { label: "Реликвия", value: "Око Болотного маяка" },
  { label: "Серия", value: "3 победы" },
  { label: "Вес", value: "18 / 50" }
];

const HERO_METRICS = [
  { label: "Выносливость", value: "101 / 151" },
  { label: "Билеты", value: "12" },
  { label: "Уведомления", value: "3" }
];

const PROFILE_STATS = [
  { label: "Сила", value: "17" },
  { label: "Ловкость", value: "12" },
  { label: "Защита", value: "14" },
  { label: "Крит", value: "10%" }
];

const INVENTORY_ITEMS = [
  { name: "Лунный компас", meta: "навигация", stamp: "редкий" },
  { name: "Печать охотника", meta: "метка", stamp: "тактика" },
  { name: "Глиняный амулет", meta: "защита", stamp: "оберег" }
];

const CREATURES = [
  { name: "Смотритель трясины", cr: "CR 5", tag: "болото", note: "давление, метки, контроль пространства" },
  { name: "Пепельная ведьма", cr: "CR 7", tag: "пепел", note: "ритуал, порча, призыв искр" }
];

const SHOP_OFFERS = [
  { title: "Талисман прилива", price: "6 билетов", family: "поддержка", hint: "Поднимает шанс критического спасброска." },
  { title: "Костяной ключ", price: "12 билетов", family: "риск", hint: "Открывает один скрытый эффект в сцене." }
];

export default function TestDrive() {
  const [view, setView] = useState("profile");
  const currentView = useMemo(() => VIEWS.find((item) => item.key === view) || VIEWS[0], [view]);

  return (
    <div className="test-drive-shell">
      <section className="test-drive-hero">
        <div className="test-drive-hero-copy">
          <div className="test-drive-hero-topbar">
            {HERO_METRICS.map((item) => (
              <div key={item.label} className="test-drive-metric-pill">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="test-drive-overline">Adventure UI / Test Drive</div>
          <h1>Игровой интерфейс без перегруза</h1>
          <p>
            Здесь мы проверяем более игровой, но при этом читаемый продуктовый стиль: тёплая база, более
            собранные панели, живые карточки сущностей и понятные акценты без тяжёлого декора.
          </p>
          <div className="test-drive-actions">
            <button className="test-drive-btn primary">
              <Sparkles className="icon" aria-hidden="true" />Сохранить направление
            </button>
            <button className="test-drive-btn secondary">
              <Eye className="icon" aria-hidden="true" />Сравнить с текущим UI
            </button>
          </div>
        </div>

        <div className="test-drive-codex">
          <div className="test-drive-codex-frame">
            <div className="test-drive-stage-tabs">
              <button type="button" className="test-drive-stage-tab active">Усиление</button>
              <button type="button" className="test-drive-stage-tab">Навык</button>
              <button type="button" className="test-drive-stage-tab">Снаряжение</button>
            </div>
            <div className="test-drive-codex-art">
              <div className="test-drive-codex-glyph">ADV</div>
              <div className="test-drive-codex-title">Тёплая база и сильные акценты</div>
              <div className="test-drive-codex-meta">игровой характер через карточки, статусы и hero-блоки</div>
            </div>
          </div>
        </div>
      </section>

      <section className="test-drive-toolbar">
        <div className="test-drive-view-tabs">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`test-drive-chip${view === item.key ? " active" : ""}`.trim()}
                onClick={() => setView(item.key)}
              >
                <Icon className="icon" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="test-drive-status">
          <span className="test-drive-badge moss">Primary: moss</span>
          <span className="test-drive-badge gold">Accent: brass</span>
          <span className="test-drive-badge ink">Surface: light panels</span>
        </div>
      </section>

      <section className="test-drive-command-bar">
        <div className="test-drive-command-strip">
          <button type="button" className="test-drive-command-btn active">Обзор</button>
          <button type="button" className="test-drive-command-btn">Loadout</button>
          <button type="button" className="test-drive-command-btn">Улучшения</button>
          <button type="button" className="test-drive-command-btn">Квесты</button>
        </div>
        <div className="test-drive-command-meta">
          <span className="test-drive-badge gold">Party UI</span>
          <span className="test-drive-badge moss">Tactical Fantasy</span>
        </div>
      </section>

      <section className="test-drive-grid">
        <aside className="test-drive-rail">
          <div className="test-drive-panel">
            <div className="test-drive-panel-head">
              <div>
                <div className="test-drive-panel-title">Партия</div>
                <div className="small">Левая рейка плотнее, полезнее и ближе к игровому roster-screen.</div>
              </div>
              <span className="test-drive-badge moss">3 игрока</span>
            </div>
            <div className="test-drive-party-list">
              {PARTY.map((member) => (
                <button key={member.id} type="button" className={`test-drive-party-card accent-${member.accent}`}>
                  <div className="test-drive-avatar">{member.name.slice(0, 1)}</div>
                  <div className="test-drive-party-copy">
                    <div className="test-drive-party-name">{member.name}</div>
                    <div className="small">{member.role}</div>
                  </div>
                  <span className="test-drive-stamp">{member.state}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="test-drive-panel accent">
            <div className="test-drive-panel-head">
              <div>
                <div className="test-drive-panel-title">Дизайн-правила</div>
                <div className="small">Игровой вайб через акценты и структуру, а не через сплошной декор.</div>
              </div>
              <WandSparkles className="icon" aria-hidden="true" />
            </div>
            <div className="test-drive-mini-grid">
              <div className="test-drive-stat-card">
                <strong>Читаемость</strong>
                <span>Светлые панели, тёмный текст, понятные action-кнопки.</span>
              </div>
              <div className="test-drive-stat-card">
                <strong>Игровость</strong>
                <span>Карточки предметов, монстров и профиля получают больше характера.</span>
              </div>
              <div className="test-drive-stat-card">
                <strong>Дисциплина</strong>
                <span>Меньше пустоты и меньше одинаковых бежевых прямоугольников.</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="test-drive-main">
          <div className="test-drive-panel">
            <div className="test-drive-panel-head">
              <div>
                <div className="test-drive-panel-title">{currentView.label}</div>
                <div className="small">Один экран, четыре игровых сценария для проверки новой системы.</div>
              </div>
              <button className="test-drive-btn ghost">Сменить паттерн</button>
            </div>

            {view === "profile" ? (
              <div className="test-drive-content-grid">
                <article className="test-drive-entity-card">
                  <div className="test-drive-entity-art test-drive-entity-art-lg">D</div>
                  <div className="test-drive-entity-copy">
                    <div className="test-drive-kicker">Публичный профиль</div>
                    <div className="test-drive-entity-title">Dri, архивариус ветра</div>
                    <div className="small">Человек • маг • уровень 4</div>
                    <div className="test-drive-inline-stats">
                      {LOADOUT.map((item) => (
                        <div key={item.label} className="test-drive-stat-pill">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="test-drive-panel inset-panel">
                  <div className="test-drive-panel-title">Приватный блок</div>
                  <div className="test-drive-tactical-stat-list">
                    {PROFILE_STATS.map((item) => (
                      <div key={item.label} className="test-drive-tactical-stat-row">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="test-drive-mini-grid">
                    <div className="test-drive-stat-card">
                      <Shield className="icon" aria-hidden="true" />
                      <strong>Статы</strong>
                      <span>Остаются рабочим UI, но больше не теряются в плоской форме.</span>
                    </div>
                    <div className="test-drive-stat-card">
                      <UserRound className="icon" aria-hidden="true" />
                      <strong>Права</strong>
                      <span>Редактирование и заявки уводятся во вторичный, но читаемый слой.</span>
                    </div>
                  </div>
                </article>
              </div>
            ) : null}

            {view === "inventory" ? (
              <div className="test-drive-card-grid">
                {INVENTORY_ITEMS.map((item) => (
                  <article key={item.name} className="test-drive-loot-card">
                    <div className="test-drive-loot-top">
                      <span className="test-drive-badge gold">{item.stamp}</span>
                      <Backpack className="icon" aria-hidden="true" />
                    </div>
                    <div className="test-drive-loot-title">{item.name}</div>
                    <div className="small">{item.meta}</div>
                    <button className="test-drive-btn secondary">Открыть карточку</button>
                  </article>
                ))}
              </div>
            ) : null}

            {view === "bestiary" ? (
              <div className="test-drive-card-grid">
                {CREATURES.map((creature) => (
                  <article key={creature.name} className="test-drive-monster-card">
                    <div className="test-drive-monster-frame">
                      <div className="test-drive-monster-sigil">{creature.name.slice(0, 1)}</div>
                    </div>
                    <div className="test-drive-kicker">{creature.tag}</div>
                    <div className="test-drive-loot-title">{creature.name}</div>
                    <div className="small">{creature.note}</div>
                    <div className="test-drive-monster-meta">
                      <span>{creature.cr}</span>
                      <button className="test-drive-btn ghost">Открыть</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {view === "shop" ? (
              <div className="test-drive-card-grid">
                {SHOP_OFFERS.map((offer) => (
                  <article key={offer.title} className="test-drive-offer-card">
                    <div className="test-drive-offer-head">
                      <span className="test-drive-badge ink">{offer.family}</span>
                      <span className="test-drive-price">{offer.price}</span>
                    </div>
                    <div className="test-drive-loot-title">{offer.title}</div>
                    <div className="small">{offer.hint}</div>
                    <button className="test-drive-btn primary">
                      <Swords className="icon" aria-hidden="true" />Добавить в набор
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
