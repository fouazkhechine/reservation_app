import { useEffect, useMemo, useState } from "react";

type Screen =
  | "splash"
  | "home"
  | "services"
  | "schedule"
  | "details"
  | "summary"
  | "success"
  | "bookings";
type AdminView = "overview" | "reservations" | "calendar" | "services" | "notifications";

const photos = {
  hero: "https://images.unsplash.com/photo-1635346125627-74d1b2867898?auto=format&fit=crop&w=1200&q=88",
  cut: "https://images.unsplash.com/photo-1635346087012-50cffbeb575f?auto=format&fit=crop&w=800&q=85",
  beard:
    "https://images.unsplash.com/photo-1788627720467-a7a751bcd9de?auto=format&fit=crop&w=800&q=85",
  portrait:
    "https://images.unsplash.com/photo-1790575546981-3ed726a823f1?auto=format&fit=crop&w=800&q=85",
};

const services = [
  {
    id: 1,
    name: "Coupe classique",
    desc: "Coupe précise, finitions aux ciseaux",
    price: 1800,
    duration: 45,
    image: photos.cut,
  },
  {
    id: 2,
    name: "Dégradé",
    desc: "Dégradé progressif et contours nets",
    price: 2200,
    duration: 50,
    image: photos.hero,
  },
  {
    id: 3,
    name: "Skin fade",
    desc: "Dégradé à blanc, finition premium",
    price: 2500,
    duration: 60,
    image: photos.portrait,
  },
  {
    id: 4,
    name: "Taille de barbe",
    desc: "Sculpture, serviette chaude et huile",
    price: 1200,
    duration: 30,
    image: photos.beard,
  },
  {
    id: 5,
    name: "Coupe + barbe",
    desc: "Rituel complet signature à domicile",
    price: 3200,
    duration: 75,
    image: photos.hero,
  },
  {
    id: 6,
    name: "Soin capillaire",
    desc: "Shampoing, massage et coiffage",
    price: 900,
    duration: 25,
    image: photos.cut,
  },
  {
    id: 7,
    name: "Soin du visage",
    desc: "Nettoyage profond et hydratation",
    price: 1600,
    duration: 35,
    image: photos.portrait,
  },
];

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.7-4 3.4-6 8-6s7.3 2 8 6" />
      </>
    ),
    scissors: (
      <>
        <circle cx="6" cy="7" r="3" />
        <circle cx="6" cy="17" r="3" />
        <path d="m8.7 8.4 11.3 6.1M8.7 15.6 20 9.5" />
      </>
    ),
    arrow: (
      <>
        <path d="m9 18 6-6-6-6" />
      </>
    ),
    back: (
      <>
        <path d="m15 18-6-6 6-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    phone: (
      <>
        <path d="M6.6 3h3l1.5 5-2 1.6a15 15 0 0 0 5.3 5.3l1.6-2 5 1.5v3c0 2-1.6 3.6-3.6 3.6C9.4 21 3 14.6 3 6.6 3 4.6 4.6 3 6.6 3Z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

const Logo = ({ compact = false }: { compact?: boolean }) => (
  <div className={`brand ${compact ? "brand-compact" : ""}`}>
    <span className="brand-mark">
      <Icon name="scissors" size={compact ? 18 : 28} />
    </span>
    <span>
      <b>BARBER</b>
      {!compact && <small>PRIVÉ · ALGER</small>}
    </span>
  </div>
);

const money = (n: number) => `${n.toLocaleString("fr-FR")} DZD`;
const steps = ["Services", "Créneau", "Coordonnées", "Résumé"];

function Progress({ screen }: { screen: Screen }) {
  const index = ["services", "schedule", "details", "summary"].indexOf(screen);
  if (index < 0) return null;
  return (
    <div className="progress">
      {steps.map((s, i) => (
        <div key={s} className={i <= index ? "active" : ""}>
          <span>{i < index ? <Icon name="check" size={12} /> : i + 1}</span>
          <small>{s}</small>
        </div>
      ))}
    </div>
  );
}

function TopBar({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="mobile-top">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
      ) : (
        <Logo compact />
      )}
      {title && <strong>{title}</strong>}
      <div className="top-right">{right ?? <span />}</div>
    </header>
  );
}

function MobileApp({ openAdmin }: { openAdmin: () => void }) {
  const [screen, setScreen] = useState<Screen>("splash");
  const [selected, setSelected] = useState<number[]>([5]);
  const [date, setDate] = useState(2);
  const [time, setTime] = useState("14:00");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    wilaya: "Alger",
    commune: "",
    address: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const chosen = services.filter((s) => selected.includes(s.id));
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  const duration = chosen.reduce((sum, s) => sum + s.duration, 0);

  useEffect(() => {
    const t = window.setTimeout(() => setScreen((s) => (s === "splash" ? "home" : s)), 1600);
    return () => window.clearTimeout(t);
  }, []);

  const toggleService = (id: number) =>
    setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = "Saisissez votre nom complet";
    if (!/^(0|\+213)[5-7]\d{8}$/.test(form.phone.replace(/\s/g, "")))
      e.phone = "Numéro algérien invalide";
    if (!form.commune) e.commune = "Sélectionnez une commune";
    if (form.address.trim().length < 8) e.address = "Précisez votre adresse";
    setErrors(e);
    if (!Object.keys(e).length) setScreen("summary");
  };
  const goBack = () => {
    const map: Partial<Record<Screen, Screen>> = {
      services: "home",
      schedule: "services",
      details: "schedule",
      summary: "details",
      bookings: "home",
    };
    setScreen(map[screen] ?? "home");
  };

  if (screen === "splash")
    return (
      <main className="phone splash" onClick={() => setScreen("home")}>
        <div className="splash-glow" />
        <div className="splash-rule" />
        <Logo />
        <p>LE BARBIER VIENT À VOUS</p>
        <span className="loader" />
        <small>ALGER · ALGÉRIE</small>
      </main>
    );

  return (
    <main className="phone">
      {screen === "home" && (
        <Home
          onBook={() => setScreen("services")}
          onBookings={() => setScreen("bookings")}
          openAdmin={openAdmin}
        />
      )}
      {screen === "services" && (
        <>
          <TopBar title="Choisir vos services" onBack={goBack} />
          <Progress screen={screen} />
          <section className="mobile-content">
            <div className="section-intro">
              <span className="eyebrow">ÉTAPE 01</span>
              <h1>
                Votre rituel,
                <br />
                <em>sur mesure.</em>
              </h1>
              <p>Sélectionnez un ou plusieurs services.</p>
            </div>
            <div className="service-list">
              {services.map((s) => (
                <article
                  key={s.id}
                  className={`service-row ${selected.includes(s.id) ? "selected" : ""}`}
                  onClick={() => toggleService(s.id)}
                >
                  <img src={s.image} alt="Service de barbier" />
                  <div className="service-info">
                    <h3>{s.name}</h3>
                    <p>{s.desc}</p>
                    <span>
                      <Icon name="clock" size={14} />
                      {s.duration} min
                    </span>
                  </div>
                  <div className="service-price">
                    <b>{money(s.price)}</b>
                    <button aria-label={`Sélectionner ${s.name}`}>
                      {selected.includes(s.id) ? (
                        <Icon name="check" size={16} />
                      ) : (
                        <Icon name="plus" size={16} />
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <BookingBar
            count={selected.length}
            total={total}
            duration={duration}
            disabled={!selected.length}
            onClick={() => setScreen("schedule")}
          />
        </>
      )}
      {screen === "schedule" && (
        <Schedule
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          duration={duration}
          total={total}
          onBack={goBack}
          onNext={() => setScreen("details")}
        />
      )}
      {screen === "details" && (
        <Details form={form} setForm={setForm} errors={errors} onBack={goBack} onNext={validate} />
      )}
      {screen === "summary" && (
        <Summary
          chosen={chosen}
          total={total}
          duration={duration}
          form={form}
          date={date}
          time={time}
          onBack={goBack}
          onConfirm={() => setScreen("success")}
        />
      )}
      {screen === "success" && (
        <Success
          total={total}
          duration={duration}
          time={time}
          onHome={() => setScreen("home")}
          onBookings={() => setScreen("bookings")}
        />
      )}
      {screen === "bookings" && <MyBookings onBack={goBack} onBook={() => setScreen("services")} />}
    </main>
  );
}

function Home({
  onBook,
  onBookings,
  openAdmin,
}: {
  onBook: () => void;
  onBookings: () => void;
  openAdmin: () => void;
}) {
  return (
    <>
      <TopBar
        right={
          <button className="avatar" onClick={openAdmin} aria-label="Espace professionnel">
            KM
          </button>
        }
      />
      <section className="home-content">
        <p className="welcome">
          Bonjour, <strong>Karim</strong>
        </p>
        <article className="hero">
          <img src={photos.hero} alt="Barbier professionnel réalisant une coupe" />
          <div className="hero-shade" />
          <div className="hero-copy">
            <span className="eyebrow">SERVICE À DOMICILE · ALGER</span>
            <h1>
              Votre style.
              <br />
              <em>Chez vous.</em>
            </h1>
            <p>
              L’excellence d’un barbier privé,
              <br />
              sans quitter votre domicile.
            </p>
            <button className="gold-btn" onClick={onBook}>
              Réserver maintenant <Icon name="arrow" />
            </button>
          </div>
          <div className="rating">
            <b>4.9</b>
            <span>★★★★★</span>
            <small>+240 clients</small>
          </div>
        </article>
        <div className="section-heading">
          <div>
            <span className="eyebrow">NOS SIGNATURES</span>
            <h2>Services populaires</h2>
          </div>
          <button onClick={onBook}>
            Tout voir <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="popular-grid">
          {services.slice(1, 4).map((s) => (
            <article key={s.id} onClick={onBook}>
              <img src={s.image} alt={s.name} />
              <div>
                <h3>{s.name}</h3>
                <p>{money(s.price)}</p>
                <span>{s.duration} min</span>
              </div>
            </article>
          ))}
        </div>
        <article className="availability-card">
          <div className="availability-icon">
            <Icon name="clock" />
          </div>
          <div>
            <span className="eyebrow">DISPONIBILITÉ</span>
            <h3>Ouvert aujourd’hui</h3>
            <p>09:00 — 20:00</p>
          </div>
          <button onClick={onBook}>Voir les créneaux</button>
        </article>
        <footer className="contact-strip">
          <span>
            <Icon name="phone" size={16} /> 0550 24 18 18
          </span>
          <span>
            <Icon name="pin" size={16} /> Alger & environs
          </span>
        </footer>
      </section>
      <nav className="bottom-nav">
        <button className="active">
          <Icon name="home" />
          <span>Accueil</span>
        </button>
        <button onClick={onBook}>
          <Icon name="calendar" />
          <span>Réserver</span>
        </button>
        <button onClick={onBookings}>
          <Icon name="list" />
          <span>Mes rendez-vous</span>
        </button>
        <button onClick={openAdmin}>
          <Icon name="user" />
          <span>Profil</span>
        </button>
      </nav>
    </>
  );
}

function BookingBar({
  count,
  total,
  duration,
  disabled,
  onClick,
}: {
  count: number;
  total: number;
  duration: number;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <aside className="booking-bar">
      <div>
        <span>
          {count} service{count > 1 ? "s" : ""} · {duration} min
        </span>
        <strong>{money(total)}</strong>
      </div>
      <button className="gold-btn" disabled={disabled} onClick={onClick}>
        Continuer <Icon name="arrow" />
      </button>
    </aside>
  );
}

function Schedule({
  date,
  setDate,
  time,
  setTime,
  duration,
  total,
  onBack,
  onNext,
}: {
  date: number;
  setDate: (n: number) => void;
  time: string;
  setTime: (s: string) => void;
  duration: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const dates = [
    { d: 19, day: "Lun" },
    { d: 20, day: "Mar" },
    { d: 21, day: "Mer" },
    { d: 22, day: "Jeu" },
    { d: 23, day: "Ven" },
    { d: 24, day: "Sam" },
    { d: 25, day: "Dim" },
  ];
  const slots = ["09:00", "10:30", "11:30", "13:00", "14:00", "15:30", "17:00", "18:30"];
  const unavailable = date === 2 ? ["10:30", "13:00", "17:00"] : ["09:00", "14:00"];
  return (
    <>
      <TopBar title="Date & heure" onBack={onBack} />
      <Progress screen="schedule" />
      <section className="mobile-content schedule">
        <div className="section-intro">
          <span className="eyebrow">ÉTAPE 02</span>
          <h1>
            Choisissez votre
            <br />
            <em>moment.</em>
          </h1>
        </div>
        <div className="month-line">
          <button className="icon-btn">
            <Icon name="back" size={18} />
          </button>
          <strong>Mai 2025</strong>
          <button className="icon-btn">
            <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="date-strip">
          {dates.map((x, i) => (
            <button
              key={x.d}
              onClick={() => {
                setDate(i);
                setTime("");
              }}
              className={date === i ? "active" : ""}
            >
              <span>{x.day}</span>
              <strong>{x.d}</strong>
              {i === 2 && <i />}
            </button>
          ))}
        </div>
        <div className="slot-header">
          <h2>Créneaux disponibles</h2>
          <span>
            <i /> Disponible
          </span>
        </div>
        <div className="slots">
          {slots.map((s) => {
            const blocked = unavailable.includes(s);
            return (
              <button
                key={s}
                disabled={blocked}
                className={time === s ? "active" : ""}
                onClick={() => setTime(s)}
              >
                {s}
                {blocked && <small>Occupé</small>}
              </button>
            );
          })}
        </div>
        <p className="slot-note">
          <Icon name="clock" size={16} /> Les créneaux incompatibles avec vos {duration} min de
          prestation sont automatiquement bloqués.
        </p>
        <article className="mini-summary">
          <span className="eyebrow">VOTRE RENDEZ-VOUS</span>
          <div>
            <Icon name="calendar" />
            <p>
              <strong>Mercredi 21 mai</strong>
              <span>
                {time || "Choisissez une heure"} · {duration} min
              </span>
            </p>
            <b>{money(total)}</b>
          </div>
        </article>
      </section>
      <aside className="single-action">
        <button className="gold-btn" disabled={!time} onClick={onNext}>
          Confirmer ce créneau <Icon name="arrow" />
        </button>
      </aside>
    </>
  );
}

type FormState = {
  name: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string;
  notes: string;
};
function Details({
  form,
  setForm,
  errors,
  onBack,
  onNext,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
  onBack: () => void;
  onNext: () => void;
}) {
  const field = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <>
      <TopBar title="Vos coordonnées" onBack={onBack} />
      <Progress screen="details" />
      <section className="mobile-content details">
        <div className="section-intro">
          <span className="eyebrow">ÉTAPE 03</span>
          <h1>
            Où devons-nous
            <br />
            <em>vous retrouver ?</em>
          </h1>
          <p>Vos informations sont uniquement utilisées pour votre réservation.</p>
        </div>
        <div className="form-grid">
          <label className={errors.name ? "error" : ""}>
            <span>Nom complet</span>
            <div>
              <Icon name="user" />
              <input
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="Ex. Karim Benali"
              />
            </div>
            {errors.name && <small>{errors.name}</small>}
          </label>
          <label className={errors.phone ? "error" : ""}>
            <span>Téléphone</span>
            <div>
              <Icon name="phone" />
              <input
                value={form.phone}
                onChange={(e) => field("phone", e.target.value)}
                placeholder="0550 00 00 00"
                inputMode="tel"
              />
            </div>
            {errors.phone && <small>{errors.phone}</small>}
          </label>
          <div className="form-pair">
            <label>
              <span>Wilaya</span>
              <div>
                <Icon name="pin" />
                <select value={form.wilaya} onChange={(e) => field("wilaya", e.target.value)}>
                  <option>Alger</option>
                  <option>Blida</option>
                  <option>Boumerdès</option>
                </select>
              </div>
            </label>
            <label className={errors.commune ? "error" : ""}>
              <span>Commune</span>
              <div>
                <select value={form.commune} onChange={(e) => field("commune", e.target.value)}>
                  <option value="">Choisir</option>
                  <option>Hydra</option>
                  <option>El Biar</option>
                  <option>Chéraga</option>
                  <option>Dely Brahim</option>
                </select>
              </div>
              {errors.commune && <small>{errors.commune}</small>}
            </label>
          </div>
          <label className={errors.address ? "error" : ""}>
            <span>Adresse détaillée</span>
            <div>
              <Icon name="home" />
              <input
                value={form.address}
                onChange={(e) => field("address", e.target.value)}
                placeholder="N°, rue, résidence, étage..."
              />
            </div>
            {errors.address && <small>{errors.address}</small>}
          </label>
          <label>
            <span>
              Instructions <i>Facultatif</i>
            </span>
            <textarea
              value={form.notes}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Interphone, repère, préférence particulière..."
            />
          </label>
        </div>
      </section>
      <aside className="single-action">
        <button className="gold-btn" onClick={onNext}>
          Vérifier ma réservation <Icon name="arrow" />
        </button>
      </aside>
    </>
  );
}

function Summary({
  chosen,
  total,
  duration,
  form,
  date,
  time,
  onBack,
  onConfirm,
}: {
  chosen: typeof services;
  total: number;
  duration: number;
  form: FormState;
  date: number;
  time: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <TopBar title="Récapitulatif" onBack={onBack} />
      <Progress screen="summary" />
      <section className="mobile-content summary">
        <div className="section-intro">
          <span className="eyebrow">DERNIÈRE ÉTAPE</span>
          <h1>
            Tout est <em>parfait.</em>
          </h1>
          <p>Vérifiez les détails avant de confirmer.</p>
        </div>
        <article className="summary-card featured">
          <span className="eyebrow">RENDEZ-VOUS</span>
          <div className="summary-date">
            <Icon name="calendar" size={26} />
            <p>
              <strong>{date === 2 ? "Mercredi 21 mai 2025" : "Votre date sélectionnée"}</strong>
              <span>
                {time} · Durée estimée {duration} min
              </span>
            </p>
          </div>
        </article>
        <article className="summary-card">
          <header>
            <span className="eyebrow">SERVICES</span>
            <button onClick={onBack}>Modifier</button>
          </header>
          {chosen.map((s) => (
            <div className="summary-line" key={s.id}>
              <span>
                {s.name}
                <small>{s.duration} min</small>
              </span>
              <b>{money(s.price)}</b>
            </div>
          ))}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <header>
            <span className="eyebrow">ADRESSE & CONTACT</span>
            <button onClick={onBack}>Modifier</button>
          </header>
          <div className="contact-line">
            <Icon name="user" />
            <p>
              <strong>{form.name}</strong>
              <span>{form.phone}</span>
            </p>
          </div>
          <div className="contact-line">
            <Icon name="pin" />
            <p>
              <strong>
                {form.commune}, {form.wilaya}
              </strong>
              <span>{form.address}</span>
            </p>
          </div>
        </article>
        <p className="terms">
          En confirmant, vous acceptez les conditions de réservation et la politique d’annulation de
          BARBER.
        </p>
      </section>
      <aside className="confirm-bar">
        <div>
          <span>Total à régler</span>
          <strong>{money(total)}</strong>
          <small>Paiement après la prestation</small>
        </div>
        <button className="gold-btn" onClick={onConfirm}>
          Confirmer <Icon name="check" />
        </button>
      </aside>
    </>
  );
}

function Success({
  total,
  duration,
  time,
  onHome,
  onBookings,
}: {
  total: number;
  duration: number;
  time: string;
  onHome: () => void;
  onBookings: () => void;
}) {
  return (
    <section className="success-screen">
      <div className="success-glow" />
      <Logo compact />
      <div className="success-seal">
        <span>
          <Icon name="check" size={34} />
        </span>
      </div>
      <span className="eyebrow">RÉSERVATION CONFIRMÉE</span>
      <h1>
        Votre rendez-vous
        <br />
        est <em>confirmé.</em>
      </h1>
      <p>
        Nous avons hâte de prendre soin de vous.
        <br />
        Un SMS de confirmation vient de vous être envoyé.
      </p>
      <article className="ticket">
        <header>
          <span>BARBER PRIVÉ</span>
          <b>#BRB-250521-084</b>
        </header>
        <div>
          <p>
            <span>Date</span>
            <strong>Mer. 21 mai 2025</strong>
          </p>
          <p>
            <span>Heure</span>
            <strong>{time}</strong>
          </p>
        </div>
        <div>
          <p>
            <span>Durée</span>
            <strong>{duration} minutes</strong>
          </p>
          <p>
            <span>Total</span>
            <strong>{money(total)}</strong>
          </p>
        </div>
        <footer>
          <Icon name="pin" size={16} /> Hydra, Alger · À votre domicile
        </footer>
      </article>
      <button className="gold-btn wide" onClick={onBookings}>
        Voir mes rendez-vous <Icon name="arrow" />
      </button>
      <button className="text-btn" onClick={onHome}>
        Retour à l’accueil
      </button>
    </section>
  );
}

function MyBookings({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const [tab, setTab] = useState("À venir");
  const items =
    tab === "À venir"
      ? [
          {
            date: "21",
            month: "MAI",
            title: "Coupe + barbe",
            time: "14:00",
            status: "Confirmé",
            price: 3200,
          },
        ]
      : tab === "Terminés"
        ? [
            {
              date: "06",
              month: "AVR",
              title: "Dégradé",
              time: "11:30",
              status: "Terminé",
              price: 2200,
            },
          ]
        : [];
  return (
    <>
      <TopBar title="Mes rendez-vous" onBack={onBack} />
      <section className="mobile-content bookings-page">
        <div className="section-intro">
          <span className="eyebrow">VOTRE HISTORIQUE</span>
          <h1>
            Mes <em>réservations.</em>
          </h1>
        </div>
        <div className="tabs">
          {["À venir", "Terminés", "Annulés"].map((x) => (
            <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>
              {x}
            </button>
          ))}
        </div>
        {items.length ? (
          items.map((x, i) => (
            <article className="booking-card" key={i}>
              <div className="date-block">
                <strong>{x.date}</strong>
                <span>{x.month}</span>
              </div>
              <div>
                <span className={`status ${x.status === "Terminé" ? "done" : ""}`}>{x.status}</span>
                <h3>{x.title}</h3>
                <p>
                  <Icon name="clock" size={15} />
                  {x.time} · 75 min
                </p>
                <p>
                  <Icon name="pin" size={15} />
                  Hydra, Alger
                </p>
              </div>
              <div className="booking-side">
                <b>{money(x.price)}</b>
                <button>
                  <Icon name="more" />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <span>
              <Icon name="calendar" size={30} />
            </span>
            <h3>Aucune réservation annulée</h3>
            <p>Vos rendez-vous annulés apparaîtront ici.</p>
          </div>
        )}
        <button className="gold-btn wide" onClick={onBook}>
          <Icon name="plus" />
          Nouvelle réservation
        </button>
      </section>
    </>
  );
}

const initialBookings = [
  {
    id: "BRB-084",
    customer: "Karim Benali",
    phone: "0550 24 18 18",
    date: "21 mai 2025",
    time: "09:00",
    service: "Coupe + barbe",
    price: 3200,
    address: "Hydra, Alger",
    status: "Confirmé",
  },
  {
    id: "BRB-085",
    customer: "Amine Khelifi",
    phone: "0661 09 44 12",
    date: "21 mai 2025",
    time: "11:30",
    service: "Skin fade",
    price: 2500,
    address: "El Biar, Alger",
    status: "En attente",
  },
  {
    id: "BRB-086",
    customer: "Samir Haddad",
    phone: "0770 88 21 05",
    date: "21 mai 2025",
    time: "14:00",
    service: "Dégradé + barbe",
    price: 3400,
    address: "Dely Brahim, Alger",
    status: "En cours",
  },
  {
    id: "BRB-087",
    customer: "Yacine Meziane",
    phone: "0558 16 30 90",
    date: "21 mai 2025",
    time: "17:00",
    service: "Coupe classique",
    price: 1800,
    address: "Chéraga, Alger",
    status: "En attente",
  },
];

function AdminDashboard({ close }: { close: () => void }) {
  const [view, setView] = useState<AdminView>("overview");
  const [bookings, setBookings] = useState(initialBookings);
  const [serviceStates, setServiceStates] = useState(
    services.slice(0, 6).map((s) => ({ ...s, active: true })),
  );
  const [toast, setToast] = useState("");
  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  };
  const updateStatus = (id: string, status: string) => {
    setBookings((v) => v.map((b) => (b.id === id ? { ...b, status } : b)));
    notify(`Réservation ${id} mise à jour`);
  };
  const menu: { id: AdminView; label: string; icon: string }[] = [
    { id: "overview", label: "Vue d’ensemble", icon: "grid" },
    { id: "reservations", label: "Réservations", icon: "list" },
    { id: "calendar", label: "Calendrier", icon: "calendar" },
    { id: "services", label: "Services", icon: "scissors" },
    { id: "notifications", label: "Notifications", icon: "bell" },
  ];
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <Logo />
        <div className="admin-profile">
          <span>MB</span>
          <div>
            <strong>Mehdi Barber</strong>
            <small>Administrateur</small>
          </div>
        </div>
        <nav>
          {menu.map((x) => (
            <button
              className={view === x.id ? "active" : ""}
              key={x.id}
              onClick={() => setView(x.id)}
            >
              <Icon name={x.icon} />
              {x.label}
              {x.id === "notifications" && <i>3</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button>
            <Icon name="settings" />
            Paramètres
          </button>
          <button onClick={close}>
            <Icon name="close" />
            Quitter l’espace pro
          </button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-top">
          <div>
            <span className="eyebrow">ESPACE PROFESSIONNEL</span>
            <h1>{menu.find((x) => x.id === view)?.label}</h1>
          </div>
          <div className="admin-actions">
            <button className="admin-date">
              <Icon name="calendar" />
              21 mai 2025
            </button>
            <button className="bell-btn" onClick={() => setView("notifications")}>
              <Icon name="bell" />
              <i />
            </button>
            <span className="admin-avatar">MB</span>
          </div>
        </header>
        {view === "overview" && <Overview bookings={bookings} setView={setView} />}
        {view === "reservations" && (
          <Reservations bookings={bookings} updateStatus={updateStatus} />
        )}
        {view === "calendar" && <CalendarView bookings={bookings} />}
        {view === "services" && (
          <AdminServices states={serviceStates} setStates={setServiceStates} notify={notify} />
        )}
        {view === "notifications" && <Notifications />}
      </section>
      {toast && (
        <div className="toast">
          <Icon name="check" />
          {toast}
        </div>
      )}
    </main>
  );
}

function Overview({
  bookings,
  setView,
}: {
  bookings: typeof initialBookings;
  setView: (v: AdminView) => void;
}) {
  const stats = [
    { label: "Réservations totales", value: "128", delta: "+12%", icon: "calendar" },
    { label: "Aujourd’hui", value: "06", delta: "4 restantes", icon: "clock" },
    {
      label: "En attente",
      value: bookings
        .filter((x) => x.status === "En attente")
        .length.toString()
        .padStart(2, "0"),
      delta: "À traiter",
      icon: "bell",
    },
    { label: "Revenu ce mois", value: "286K", delta: "+18%", icon: "grid" },
  ];
  return (
    <div className="dashboard-content">
      <div className="welcome-admin">
        <div>
          <h2>Bonjour Mehdi,</h2>
          <p>Voici l’activité de votre service aujourd’hui.</p>
        </div>
        <button className="gold-btn" onClick={() => setView("calendar")}>
          <Icon name="plus" />
          Bloquer un créneau
        </button>
      </div>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <article key={s.label}>
            <span className={`stat-icon i${i}`}>
              <Icon name={s.icon} />
            </span>
            <div>
              <small>{s.label}</small>
              <strong>
                {s.value}
                {i === 3 && <i> DZD</i>}
              </strong>
              <span>{s.delta}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <article className="panel revenue">
          <header>
            <div>
              <span className="eyebrow">PERFORMANCE</span>
              <h3>Revenus</h3>
            </div>
            <select>
              <option>6 derniers mois</option>
            </select>
          </header>
          <div className="chart-wrap">
            <div className="y-labels">
              <span>300K</span>
              <span>200K</span>
              <span>100K</span>
              <span>0</span>
            </div>
            <div className="chart">
              <svg viewBox="0 0 600 220" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#c9a45c" stopOpacity=".35" />
                    <stop offset="1" stopColor="#c9a45c" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="grid-lines" d="M0 20H600M0 80H600M0 140H600M0 200H600" />
                <path
                  className="area"
                  d="M0 170 C70 165 80 120 140 135 S220 70 280 105 S370 45 420 72 S520 25 600 38 V220 H0Z"
                />
                <path
                  className="line"
                  d="M0 170 C70 165 80 120 140 135 S220 70 280 105 S370 45 420 72 S520 25 600 38"
                />
              </svg>
              <div className="x-labels">
                <span>Déc</span>
                <span>Jan</span>
                <span>Fév</span>
                <span>Mar</span>
                <span>Avr</span>
                <span>Mai</span>
              </div>
            </div>
          </div>
        </article>
        <article className="panel today-list">
          <header>
            <div>
              <span className="eyebrow">21 MAI</span>
              <h3>Programme du jour</h3>
            </div>
            <button onClick={() => setView("reservations")}>
              Tout voir <Icon name="arrow" size={15} />
            </button>
          </header>
          {bookings.slice(0, 3).map((b) => (
            <div className="today-item" key={b.id}>
              <b>{b.time}</b>
              <span className={`dot ${b.status.replace(" ", "-").toLowerCase()}`} />
              <div>
                <strong>{b.customer}</strong>
                <small>
                  {b.service} · {b.address.split(",")[0]}
                </small>
              </div>
              <em className={`status ${b.status.replace(" ", "-").toLowerCase()}`}>{b.status}</em>
            </div>
          ))}
        </article>
      </div>
      <article className="panel recent">
        <header>
          <div>
            <span className="eyebrow">GESTION RAPIDE</span>
            <h3>Réservations récentes</h3>
          </div>
          <button onClick={() => setView("reservations")}>
            Voir toutes les réservations <Icon name="arrow" size={15} />
          </button>
        </header>
        <BookingTable bookings={bookings.slice(0, 4)} />
      </article>
    </div>
  );
}

function BookingTable({
  bookings,
  updateStatus,
}: {
  bookings: typeof initialBookings;
  updateStatus?: (id: string, s: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Date & heure</th>
            <th>Services</th>
            <th>Adresse</th>
            <th>Total</th>
            <th>Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.customer}</strong>
                <small>{b.phone}</small>
              </td>
              <td>
                <strong>{b.date}</strong>
                <small>{b.time}</small>
              </td>
              <td>{b.service}</td>
              <td>{b.address}</td>
              <td>
                <strong>{money(b.price)}</strong>
              </td>
              <td>
                <span className={`status ${b.status.replace(" ", "-").toLowerCase()}`}>
                  {b.status}
                </span>
              </td>
              <td>
                {updateStatus ? (
                  <select
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    aria-label={`Modifier ${b.id}`}
                  >
                    <option>En attente</option>
                    <option>Confirmé</option>
                    <option>En cours</option>
                    <option>Terminé</option>
                    <option>Annulé</option>
                  </select>
                ) : (
                  <button className="icon-btn">
                    <Icon name="more" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reservations({
  bookings,
  updateStatus,
}: {
  bookings: typeof initialBookings;
  updateStatus: (id: string, s: string) => void;
}) {
  const [filter, setFilter] = useState("Tous");
  const visible = filter === "Tous" ? bookings : bookings.filter((x) => x.status === filter);
  return (
    <div className="dashboard-content">
      <div className="toolbar">
        <div className="filter-tabs">
          {["Tous", "En attente", "Confirmé", "En cours", "Terminé"].map((x) => (
            <button className={filter === x ? "active" : ""} onClick={() => setFilter(x)} key={x}>
              {x}
            </button>
          ))}
        </div>
        <button className="outline-btn">Exporter la liste</button>
      </div>
      <article className="panel reservations-panel">
        <header>
          <div>
            <span className="eyebrow">MAI 2025</span>
            <h3>{visible.length} réservations</h3>
          </div>
          <label className="search">Rechercher un client...</label>
        </header>
        <BookingTable bookings={visible} updateStatus={updateStatus} />
      </article>
    </div>
  );
}

function CalendarView({ bookings }: { bookings: typeof initialBookings }) {
  const hours = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];
  return (
    <div className="dashboard-content">
      <div className="toolbar">
        <div className="calendar-switch">
          <button>Jour</button>
          <button className="active">Semaine</button>
        </div>
        <div>
          <button className="outline-btn">
            <Icon name="settings" />
            Horaires de travail
          </button>
          <button className="gold-btn">
            <Icon name="plus" />
            Indisponibilité
          </button>
        </div>
      </div>
      <article className="panel calendar-panel">
        <header>
          <button className="icon-btn">
            <Icon name="back" />
          </button>
          <h3>19 — 25 mai 2025</h3>
          <button className="icon-btn">
            <Icon name="arrow" />
          </button>
          <button className="outline-btn">Aujourd’hui</button>
        </header>
        <div className="week-grid">
          <div className="time-col">
            <span />
            {hours.map((h) => (
              <small key={h}>{h}</small>
            ))}
          </div>
          {["Lun 19", "Mar 20", "Mer 21", "Jeu 22", "Ven 23", "Sam 24", "Dim 25"].map((d, i) => (
            <div className={`day-col ${i === 2 ? "today" : ""}`} key={d}>
              <strong>{d}</strong>
              {hours.map((h, j) => (
                <div key={h}>
                  {i === 2 && [1, 3, 6, 9].includes(j) && (
                    <span className={`cal-event e${j}`}>
                      <b>{bookings[[1, 3, 6, 9].indexOf(j)]?.time}</b>
                      {bookings[[1, 3, 6, 9].indexOf(j)]?.customer}
                    </span>
                  )}
                  {i === 4 && j === 5 && <span className="cal-event blocked">Indisponible</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function AdminServices({
  states,
  setStates,
  notify,
}: {
  states: ((typeof services)[number] & { active: boolean })[];
  setStates: React.Dispatch<
    React.SetStateAction<((typeof services)[number] & { active: boolean })[]>
  >;
  notify: (s: string) => void;
}) {
  const toggle = (id: number) => {
    setStates((v) => v.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    notify("Disponibilité du service mise à jour");
  };
  return (
    <div className="dashboard-content">
      <div className="toolbar">
        <p>Gérez vos prestations, tarifs et disponibilités.</p>
        <button
          className="gold-btn"
          onClick={() => notify("Nouveau service prêt à être configuré")}
        >
          <Icon name="plus" />
          Ajouter un service
        </button>
      </div>
      <div className="admin-service-grid">
        {states.map((s) => (
          <article className={!s.active ? "inactive" : ""} key={s.id}>
            <img src={s.image} alt={s.name} />
            <div className="service-admin-body">
              <div>
                <span className={`status ${s.active ? "confirmed" : "annulé"}`}>
                  {s.active ? "Actif" : "Inactif"}
                </span>
                <button className="icon-btn">
                  <Icon name="more" />
                </button>
              </div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <footer>
                <strong>{money(s.price)}</strong>
                <span>
                  <Icon name="clock" size={15} />
                  {s.duration} min
                </span>
                <button className={`toggle ${s.active ? "on" : ""}`} onClick={() => toggle(s.id)}>
                  <i />
                </button>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Notifications() {
  const items = [
    {
      title: "Nouvelle réservation",
      text: "Amine Khelifi a réservé un Skin fade pour aujourd’hui à 11:30.",
      age: "Il y a 4 min",
      fresh: true,
    },
    {
      title: "Réservation confirmée",
      text: "Le rendez-vous de Karim Benali a bien été confirmé.",
      age: "Il y a 28 min",
      fresh: true,
    },
    {
      title: "Annulation client",
      text: "Nassim Ouali a annulé son rendez-vous du 22 mai.",
      age: "Hier, 18:42",
      fresh: false,
    },
  ];
  return (
    <div className="dashboard-content">
      <article className="panel notification-panel">
        <header>
          <div>
            <span className="eyebrow">CENTRE D’ACTIVITÉ</span>
            <h3>Notifications récentes</h3>
          </div>
          <button>Tout marquer comme lu</button>
        </header>
        {items.map((x, i) => (
          <div className={`notification ${x.fresh ? "fresh" : ""}`} key={i}>
            <span>
              <Icon name={i === 2 ? "close" : "bell"} />
            </span>
            <div>
              <strong>{x.title}</strong>
              <p>{x.text}</p>
              <small>{x.age}</small>
            </div>
            {x.fresh && <i />}
          </div>
        ))}
      </article>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<"mobile" | "admin">(() =>
    window.innerWidth >= 980 ? "admin" : "mobile",
  );
  return mode === "admin" ? (
    <AdminDashboard close={() => setMode("mobile")} />
  ) : (
    <div className="app-stage">
      <MobileApp openAdmin={() => setMode("admin")} />
      <button className="desktop-preview-link" onClick={() => setMode("admin")}>
        Ouvrir le dashboard pro <Icon name="arrow" size={16} />
      </button>
    </div>
  );
}
