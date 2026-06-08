const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const workGrid = document.querySelector("[data-work-grid]");
const filterButtons = document.querySelectorAll("[data-filter]");
const modal = document.querySelector("[data-project-modal]");
const modalClose = document.querySelector("[data-modal-close]");
const modalVideo = document.querySelector("#modal-video");
const emailSlot = document.querySelector("[data-email-user][data-email-domain]");
const yearSlot = document.querySelector("[data-year]");

if (yearSlot) yearSlot.textContent = new Date().getFullYear();

// Reassemble the email from fragments so scraper bots don't harvest the
// full address from the static HTML. Display-only — no mailto link.
if (emailSlot) {
  emailSlot.textContent = `${emailSlot.dataset.emailUser}@${emailSlot.dataset.emailDomain}`;
}

const closeNav = () => {
  nav?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  const isOpen = nav?.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) closeNav();
});

// Scroll-driven header morph, throttled to one update per frame so the
// listener never thrashes layout on fast scrolls. Only writes the class
// when the state actually changes.
let headerScrollQueued = false;
let headerScrolledState = false;
const updateHeaderState = () => {
  headerScrollQueued = false;
  const shouldScroll = window.scrollY > 18;
  if (shouldScroll !== headerScrolledState) {
    headerScrolledState = shouldScroll;
    header?.classList.toggle("is-scrolled", shouldScroll);
  }
};
window.addEventListener("scroll", () => {
  if (!headerScrollQueued) {
    headerScrollQueued = true;
    requestAnimationFrame(updateHeaderState);
  }
}, { passive: true });

// 1. HERO VIDEO AUTOPLAY & SOUND TOGGLE LOGIC
const heroVideo = document.getElementById("hero-video");
const soundToggle = document.getElementById("hero-sound-toggle");

if (heroVideo && "IntersectionObserver" in window) {
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        heroVideo.play().catch(err => console.warn("Autoplay blocked:", err));
      } else {
        heroVideo.pause();
      }
    });
  }, { threshold: 0.1 });
  videoObserver.observe(heroVideo);
}

if (heroVideo && soundToggle) {
  soundToggle.addEventListener("click", () => {
    heroVideo.muted = !heroVideo.muted;
    soundToggle.classList.toggle("is-unmuted", !heroVideo.muted);
  });
}

// =========================================================
// 2. PORTFOLIO ENGINE — balanced, self-filling dual marquee
// =========================================================
const track1 = document.querySelector("#track-1");
const track2 = document.querySelector("#track-2");

// Build a master pool of every work card ONCE, on load, from whatever
// is currently in the two tracks. After this the tracks are rebuilt
// dynamically on every filter so both rows always stay full.
let masterCards = [];

const collectMasterCards = () => {
  const seen = new Set();
  [track1, track2].forEach((track) => {
    if (!track) return;
    Array.from(track.querySelectorAll(".work-card")).forEach((card) => {
      // Use the underlying video src as a dedupe key so we never store
      // accidental duplicates that were hardcoded in the markup.
      const v = card.querySelector("video.hover-video");
      const key = v ? v.getAttribute("src") : card.outerHTML;
      if (seen.has(key)) return;
      seen.add(key);
      masterCards.push(card.cloneNode(true));
    });
  });
};

// Attach hover-to-play + the lightweight reveal look to a freshly
// inserted card. Called every time we rebuild the rows. Image cards
// (graphics) have no video, so they simply get the CSS hover zoom.
const wireCard = (card) => {
  const video = card.querySelector("video.hover-video");
  if (!video) return;
  card.addEventListener("mouseenter", () => {
    video._playTimer = setTimeout(() => {
      video.play().catch(err => console.warn("Autoplay blocked:", err));
    }, 50);
  });
  card.addEventListener("mouseleave", () => {
    clearTimeout(video._playTimer);
    video.pause();
    video.currentTime = 0;
  });
};

// Fill a single track element with the given cards, cloning the set
// enough times that the row is wide enough to scroll seamlessly.
// The marquee keyframes translate by -50%, so we always append an
// exact second copy of the final filled set for the loop to be seamless.
const MIN_CARDS_PER_ROW = 8; // enough to span wide screens with no gap

// Card geometry (must match CSS): 160px width + 16px gap.
const CARD_WIDTH = 160;
const CARD_GAP = 16;
// Constant scroll speed in pixels/second. Duration is derived from this
// so every filter scrolls at the SAME visual speed regardless of how
// many cards are showing. (Previously a fixed 50s made short rows crawl
// and long rows race.)
const MARQUEE_SPEED = 55; // px per second

const fillTrack = (track, cards, direction) => {
  if (!track) return;
  track.innerHTML = "";
  if (!cards.length) return;

  // Repeat the card set until we have at least MIN_CARDS_PER_ROW,
  // so short filters (e.g. AI Avatar) never leave dead space.
  const base = [];
  while (base.length < MIN_CARDS_PER_ROW) {
    cards.forEach((c) => base.push(c));
  }

  // Lay down the base set, then an identical clone of it. The CSS
  // animation scrolls exactly one set width, giving an infinite loop.
  const lay = (list) => {
    list.forEach((card) => {
      const node = card.cloneNode(true);
      wireCard(node);
      track.appendChild(node);
    });
  };
  lay(base);
  lay(base);

  // One set's width = number of base cards * (card + gap).
  const setWidth = base.length * (CARD_WIDTH + CARD_GAP);
  const duration = setWidth / MARQUEE_SPEED; // seconds, constant px/sec
  track.style.animationName = direction === "right" ? "scrollRight" : "scrollLeft";
  track.style.animationTimingFunction = "linear";
  track.style.animationIterationCount = "infinite";
  track.style.animationDuration = `${duration}s`;
};

const renderFilter = (filter) => {
  const visible = masterCards.filter((card) => {
    if (filter === "all") return true;
    const cats = (card.dataset.category || "").split(" ");
    return cats.includes(filter);
  });

  // Split the visible cards across the two rows as evenly as possible
  // so the top and bottom carousels are symmetric.
  const half = Math.ceil(visible.length / 2);
  const top = visible.slice(0, half);
  const bottom = visible.slice(half);

  // If a row would be empty (only happens with 1 item), mirror the other.
  fillTrack(track1, top.length ? top : visible, "left");
  fillTrack(track2, bottom.length ? bottom : visible, "right");
};

if (track1 || track2) {
  collectMasterCards();
  renderFilter("all");
}

// 2b. FILTER BUTTON WIRING
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter || "all";
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderFilter(filter);
  });
});

// 3. SCROLL REVEAL ANIMATIONS
const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

// 4. CLIENT MARQUEE CLONING (hero side tracks are hardcoded in HTML)
const clientTrack = document.querySelector("#client-track");
const cloneTrackItems = (track) => {
  if (!track) return;
  Array.from(track.children).forEach((item) => {
    track.appendChild(item.cloneNode(true));
  });
};
cloneTrackItems(clientTrack);

// 5. CLICK TO OPEN MODAL (delegated — works on dynamically built cards)
const modalImage = document.querySelector("#modal-image");

workGrid?.addEventListener("click", (event) => {
  const card = event.target.closest(".work-card");
  if (!card || !modal) return;

  const videoElement = card.querySelector("video.hover-video");
  const imageElement = card.querySelector("img.hover-img");

  // Reset both viewers first.
  if (modalVideo) {
    modalVideo.pause();
    modalVideo.removeAttribute("src");
    modalVideo.style.display = "none";
  }
  if (modalImage) {
    modalImage.removeAttribute("src");
    modalImage.style.display = "none";
  }

  if (videoElement && modalVideo) {
    modalVideo.src = videoElement.currentSrc || videoElement.src;
    modalVideo.style.display = "block";
  } else if (imageElement && modalImage) {
    modalImage.src = imageElement.currentSrc || imageElement.src;
    modalImage.alt = imageElement.alt || "";
    modalImage.style.display = "block";
  }

  modal.showModal();
  document.body.classList.add("modal-open");

  if (videoElement && modalVideo) {
    modalVideo.play().catch(err => console.warn("Autoplay blocked:", err));
  }
});

const closeModal = () => {
  if (modal?.open) {
    modal.close();
    document.body.classList.remove("modal-open");
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.currentTime = 0;
    }
  }
};

modalClose?.addEventListener("click", closeModal);
modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
modal?.addEventListener("close", () => document.body.classList.remove("modal-open"));