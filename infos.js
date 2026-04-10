const BLOGS_API_URL =
  "https://api.github.com/repos/oscar-codexine/codexine/contents/blog?ref=main";

const FALLBACK_BLOGS = [
  {
    name: "blog13.html",
    rawUrl:
      "https://raw.githubusercontent.com/oscar-codexine/codexine/main/blog/blog13.html",
    title: "Comment creer un systeme RAG sur Mistral : Tutoriel complet et facile",
    description:
      "Decouvrez comment developper un systeme RAG efficace avec Mistral. Tutoriel etape par etape pour une meilleure comprehension.",
    image:
      "https://images.pexels.com/photos/16094044/pexels-photo-16094044.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  },
];

const blogGrid = document.getElementById("blog-grid");
const blogCount = document.getElementById("blog-count");
const blogStatus = document.getElementById("blog-status");

function getBlogOrder(name) {
  const match = name.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function cleanTitle(rawTitle, fileName) {
  const fallback = fileName.replace(/\.html$/i, "");

  if (!rawTitle) {
    return fallback;
  }

  return rawTitle.replace(/\s*\|\s*Scale Blog\s*$/i, "").trim() || fallback;
}

function injectBaseTag(html, baseHref) {
  if (/<base\s/i.test(html)) {
    return html;
  }

  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head(\b[^>]*)>/i, `<head$1><base href="${baseHref}">`);
  }

  return `<!DOCTYPE html><html><head><base href="${baseHref}"></head><body>${html}</body></html>`;
}

function setStatus(message, isError) {
  blogStatus.textContent = message;
  blogStatus.classList.toggle("is-error", Boolean(isError));
}

function setCount(total) {
  const suffix = total > 1 ? "articles" : "article";
  blogCount.textContent = `${String(total).padStart(2, "0")} ${suffix}`;
}

function renderEmpty() {
  blogGrid.innerHTML =
    '<div class="empty-state">Aucun blog HTML disponible pour le moment dans le dossier GitHub <strong>blog</strong>.</div>';
}

function createCard(blog) {
  const article = document.createElement("article");
  article.className = "blog-card";

  const button = document.createElement("button");
  button.className = "blog-card__button";
  button.type = "button";
  button.setAttribute("aria-label", `Ouvrir ${blog.title}`);

  const art = document.createElement("div");
  art.className = "blog-card__art";

  if (blog.image) {
    art.style.backgroundImage =
      `linear-gradient(180deg, rgba(18, 9, 10, 0.18), rgba(8, 8, 8, 0.88)), url("${blog.image}")`;
  }

  const body = document.createElement("div");
  body.className = "blog-card__body";

  const meta = document.createElement("div");
  meta.className = "blog-card__meta";
  meta.textContent = blog.name.replace(/\.html$/i, "");

  const title = document.createElement("h3");
  title.className = "blog-card__title";
  title.textContent = blog.title;

  const description = document.createElement("p");
  description.className = "blog-card__desc";
  description.textContent =
    blog.description || "Article disponible dans la bibliotheque CODEXINE.";

  const cta = document.createElement("div");
  cta.className = "blog-card__cta";
  cta.textContent = "Ouvrir le blog";

  body.append(meta, title, description, cta);
  button.append(art, body);
  article.append(button);

  button.addEventListener("click", async () => {
    if (button.disabled) {
      return;
    }

    const previousLabel = cta.textContent;
    button.disabled = true;
    cta.textContent = "Ouverture...";
    setStatus(`Ouverture de "${blog.title}"...`);

    try {
      const response = await fetch(blog.rawUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Impossible d'ouvrir ${blog.name}`);
      }

      const html = await response.text();
      const baseHref = blog.rawUrl.replace(/[^/]+$/, "");
      const hydratedHtml = injectBaseTag(html, baseHref);
      const blob = new Blob([hydratedHtml], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);

      window.location.assign(blobUrl);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      button.disabled = false;
      cta.textContent = previousLabel;
      setStatus("Impossible d'ouvrir ce blog pour le moment.", true);
    }
  });

  return article;
}

function renderBlogs(blogs) {
  blogGrid.innerHTML = "";

  if (!blogs.length) {
    setCount(0);
    renderEmpty();
    setStatus("Aucun blog trouve pour le moment.");
    return;
  }

  const fragment = document.createDocumentFragment();

  blogs.forEach((blog) => {
    fragment.appendChild(createCard(blog));
  });

  blogGrid.appendChild(fragment);
  setCount(blogs.length);
  setStatus(
    `${blogs.length} blog${blogs.length > 1 ? "s" : ""} charge${blogs.length > 1 ? "s" : ""}.`
  );
}

async function fetchBlogMeta(file) {
  const rawUrl = file.download_url;

  try {
    const htmlResponse = await fetch(rawUrl, { cache: "no-store" });

    if (!htmlResponse.ok) {
      throw new Error(`Failed to load ${file.name}`);
    }

    const html = await htmlResponse.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.title;
    const description =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const image = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

    return {
      name: file.name,
      rawUrl,
      title: cleanTitle(title, file.name),
      description: description.trim(),
      image,
    };
  } catch (error) {
    return {
      name: file.name,
      rawUrl,
      title: cleanTitle("", file.name),
      description: "Article disponible dans la bibliotheque CODEXINE.",
      image: "",
    };
  }
}

async function loadBlogs() {
  try {
    const response = await fetch(BLOGS_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) {
      throw new Error("GitHub API unavailable");
    }

    const items = await response.json();
    const htmlFiles = items
      .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".html"))
      .sort((first, second) => getBlogOrder(second.name) - getBlogOrder(first.name));

    if (!htmlFiles.length) {
      renderBlogs([]);
      return;
    }

    const blogs = await Promise.all(htmlFiles.map(fetchBlogMeta));
    renderBlogs(blogs);
  } catch (error) {
    renderBlogs(FALLBACK_BLOGS);
    setStatus(
      "Connexion GitHub indisponible pour le moment. Affichage d'une sauvegarde locale.",
      true
    );
  }
}

if (blogGrid && blogCount && blogStatus) {
  loadBlogs();
}
