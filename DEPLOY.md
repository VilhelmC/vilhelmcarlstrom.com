# Deploying vilhelmcarlstrom.com

*Written 2026-09-15. One pass, start to finish. Everything here is done once; §6 is the only part that recurs, and it is three commands. Where a button or field is named, that is its literal label.*

**Shape of it:** the files live in a GitHub repository; Netlify watches that repository and serves whatever is on the `main` branch; the domain's DNS stays at Porkbun and points at Netlify. Nothing builds, nothing compiles, and no machine of yours has to be running.

---

## 1 · Give the site its own repository

It currently sits inside the Proposal repo because that is where this front's work happens. It should not stay there: the site wants its own history, and two copies of a website is one copy too many.

```
	# PowerShell, from C:\Users\vilhe\Documents\GitHub
	mkdir vilhelmcarlstrom.com
	Set-Location vilhelmcarlstrom.com
	# move — do not copy — the contents of
	#   ...\ModellingResearch\Proposal\Strategic\Outreach\site\
	# into this folder, then:
	git init -b main
	git add .
	git commit -m "Holding page"
```

**Repository name: `vilhelmcarlstrom.com`.** The name states what it deploys, which matters the day there is a second site. (`vilhelmc.github.io` is a GitHub Pages convention and is not wanted here.)

**Make it public.** It is a website — anyone can read the source from the browser anyway — and for the audience this front is aimed at, a legible repository is itself part of the signal. Nothing in it is private.

Then create it on GitHub under `VilhelmC` and push:

```
	gh repo create VilhelmC/vilhelmcarlstrom.com --public --source=. --push
	# or make the empty repo in the GitHub web UI, then:
	#   git remote add origin https://github.com/VilhelmC/vilhelmcarlstrom.com.git
	#   git push -u origin main
```

**Afterwards, delete `Strategic/Outreach/site/` from the Proposal repo** and commit that deletion, so there is one copy of the site and it is the one that deploys.

## 2 · What "import from GitHub" actually means

Netlify is a host that watches a git repository. You authorise it once against your GitHub account; it then has read access to the repository you name. Whenever a commit lands on `main`, Netlify fetches the repository, runs a build command if there is one — there is not — and publishes a directory of files to its own global edge. Your laptop is not involved after the push.

So "import from GitHub" means: *connect Netlify to this repo and let it serve what is in it.*

1. Go to **app.netlify.com** and sign up. Choose **GitHub** as the sign-up method — it makes step 3 shorter.
2. In the Netlify dashboard, press **Add new site** (some accounts show **Add new project**) → **Import an existing project**.
3. Under *Deploy your site*, choose **GitHub**. A GitHub authorisation window opens.
   - When GitHub asks which repositories Netlify may see, choose **Only select repositories** and pick `vilhelmcarlstrom.com`. Do not grant access to everything; there is no reason to.
4. Back in Netlify, pick `VilhelmC/vilhelmcarlstrom.com` from the list.
5. On the *Site settings* / *Build settings* screen:

	| Field | Value |
	|---|---|
	| Branch to deploy | `main` |
	| Base directory | *(leave empty)* |
	| Build command | *(leave empty)* |
	| Publish directory | `.` |

	`netlify.toml` in the repository already declares `publish = "."`, so these should be filled in for you. If the form insists on a build command, leave it empty rather than inventing one.
6. Press **Deploy site**. It takes a few seconds. You get a URL like `resonant-kelpie-4f21a3.netlify.app`.

**Open that URL and check the page works before touching DNS.** If the field does not run there, it is not a DNS problem and DNS will not fix it.

**Then make the project public — it is not, by default.** Since 28 July 2026 Netlify creates new projects **private**, meaning anyone who is not signed in to your Netlify team gets a Netlify login page instead of the site, and the server answers `401`. Everything else can be perfectly configured and the site still be invisible to precisely the people it exists for.

*Project configuration → General → Visitor access → Project visibility → **Public***. (There is also a **Make public** button once there has been one successful production deploy.) Production deploys and deploy previews are set separately; production must be public, previews need not be.

**Rename the site** while you are here, so the temporary URL is legible: *Site configuration → Site details → Change site name* → `vilhelmcarlstrom`. The URL becomes `vilhelmcarlstrom.netlify.app`. Write that down — §4 needs it.

## 3 · Tell Netlify about the domain

1. **Site configuration → Domain management → Add a domain** (older UI: *Domains → Add custom domain*).
2. Type `vilhelmcarlstrom.com` and continue. Netlify will notice the domain is registered elsewhere and offer to **Add domain** — take that. Do **not** take any offer to buy or transfer the domain; you already own it and it stays at Porkbun.
3. Netlify adds both `vilhelmcarlstrom.com` and `www.vilhelmcarlstrom.com`, and marks one **Primary domain**. Set the primary to **`vilhelmcarlstrom.com`** (no `www`) — the page's `<link rel="canonical">` says the same, and the two must agree. Netlify redirects the other form to it automatically.
4. Both will show **Awaiting External DNS** or a *Check DNS configuration* warning. That is correct at this point; §4 fixes it.

## 4 · Point the DNS at Netlify, at Porkbun

Porkbun → **ACCOUNT** (top right) → **Domain Management** → find `vilhelmcarlstrom.com`. Either press the **DNS** button under the domain name, or press **Details** and then the edit icon under **DNS RECORDS** — both land in *Manage DNS Records*. New rows are added with **Add Record**.

**First, clear what is already there.** A freshly registered Porkbun domain arrives with parking records — typically an `ALIAS` on the root pointing at `pixie.porkbun.com` and a `CNAME` on `*`. These will collide with what you are adding, and Porkbun will refuse the new record with *"A CNAME or ALIAS record with that host already exists."* Delete both (the bin icon at the right of each row), or edit the existing ALIAS in place rather than adding a second.

Then add two records:

| Type | Host | Answer | TTL |
|---|---|---|---|
| `ALIAS - CNAME flattening` | *(leave blank)* | `apex-loadbalancer.netlify.com` | default |
| `CNAME` | `www` | `vilhelmcarlstrom.netlify.app` | default |

The blank host means the root of the domain. If for any reason the `ALIAS` type is not offered, use `A` with host blank and answer `75.2.60.5` — Netlify's load-balancer address. The ALIAS is the better of the two because it follows Netlify if that address ever changes.

**Leave the nameservers alone.** They stay Porkbun's — that is the whole reason for registering there, and changing them would hand DNS to someone else.

Now wait. Propagation is usually minutes and occasionally hours. In Netlify, *Domain management* has a **Verify DNS configuration** / **Retry DNS verification** button; press it when you think the records have landed. When it goes green, Netlify requests a Let's Encrypt certificate on its own — that appears under *HTTPS* and takes a few more minutes. You do not do anything for TLS.

From a terminal, to see it yourself:

```
	nslookup vilhelmcarlstrom.com
	nslookup www.vilhelmcarlstrom.com
```

## 5 · Point vilhelmc.com at it

That name is a second name for the same person, not a second site, so it forwards rather than serving anything.

**Do not add it to Netlify as a domain alias.** The alias and this forwarder are two ways of doing the same job, not two halves of one, and doing both gives you two systems answering for the same name. Porkbun's forwarder handles HTTPS on its own — their forwarding is served over TLS with a certificate they issue, free and automatically — which is the only thing that would otherwise have argued for the Netlify route. So `vilhelmc.com` never touches Netlify: Netlify knows about exactly one domain, and the redirect lives with the name it belongs to.

**Where it is, which is not obvious:** URL forwarding is not a top-level item. It lives inside the domain's *Details* panel.

1. Porkbun → **ACCOUNT** (top right) → **Domain Management**.
2. Find `vilhelmc.com` and press its **Details** button.
3. In the panel that opens, find the **URL FORWARDING** section and press the **edit icon** next to it.

**Clear the parking records first.** A new Porkbun domain arrives pointed at their own parking page — records referencing `pixie.porkbun.com`, which is also why the name currently redirects to an `l.ink` address. Forwarding will refuse to save while those are there, with a conflicting-records error. Delete them in that domain's DNS editor (§4's navigation, on `vilhelmc.com` this time) before coming back here.

Then fill the form. The labels are Porkbun's own:

| Field | Value |
|---|---|
| **Hostname** | *(leave blank — this forwards the root of the domain)* |
| **Forward Traffic To** | `https://vilhelmcarlstrom.com` |
| **Wildcard Forwarding** | ticked — catches the root and any subdomain |

Then open **Advanced Settings**, which is collapsed by default and holds the two options that matter:

| Field | Value |
|---|---|
| **Redirect Type** | **301 Permanent Redirect** — *not* the default temporary one, and not the masked option |
| **Include the requested URI path** | ticked — so `vilhelmc.com/anything` lands on `vilhelmcarlstrom.com/anything` |

Permanent because it is permanent, and search engines should learn which name is canonical; a temporary redirect tells them the opposite. Not masked, because masking keeps `vilhelmc.com` in the address bar while showing the other site — which hides the real address, and a stable, honest address is the entire point of this page.

Give it ten to fifteen minutes, then check `http://vilhelmc.com` lands on `https://vilhelmcarlstrom.com`.

## 6 · Changing the site afterwards

```
	# edit the files, then:
	git add -A
	git commit -m "Update the record"
	git push
```

Netlify redeploys within about thirty seconds. If you open a pull request instead, Netlify builds a **deploy preview** on its own URL, which is a good habit for anything more than a typo. *Deploys → (a deploy) → Publish deploy* rolls back to any earlier version instantly if something goes wrong.

The record is the only part expected to change, and it changes rarely. That is by design.

## 7 · When it does not work

| What you see | What it is |
|---|---|
| Netlify still says *Awaiting External DNS* after an hour | The records have not propagated, or the parking `ALIAS`/`CNAME` is still there. Check the DNS editor again — the collision is the usual cause. |
| `www` works, the bare domain does not | The `ALIAS` row is missing or its Host field is not blank. |
| The bare domain works, `www` does not | The `www` `CNAME` points at the wrong place. Its answer is the `*.netlify.app` name, not the domain itself. |
| *This site can't provide a secure connection* | The certificate has not been issued yet. Wait; then *Domain management → HTTPS → Verify DNS configuration*. |
| Certificate never issues | Rare: a `CAA` record on the domain forbidding Let's Encrypt. Porkbun does not add one by default, so only check this if you added one. |
| The page loads but the background is a flat gradient | Not a deployment problem — that is `field.js` falling back because the browser has no usable WebGL2. Expected on some older machines and in some privacy configurations. |
| `vilhelmc.com` still shows a Porkbun or `l.ink` parking page | The parking records are still in place. Forwarding cannot override them — delete them in that domain's DNS editor first. |
| The site returns `401`, or you land on a Netlify login or *Team protection* page | The project is still private — Netlify's default for new projects. §2, *Make public*. This is the one failure that looks like a DNS or certificate problem and is neither. |
| A stale version is being served | Hard-reload (Ctrl+F5). If it persists, check *Deploys* — the newest one may have failed. |

## 8 · What is deliberately absent

No analytics, no cookie banner, no consent dialogue, no tag manager, no contact form, no newsletter, no CMS. The page collects nothing, so it needs to disclose nothing and ask permission for nothing — which is also why it can stay up for years without attention. Adding any one of those changes that, and the first of them to be added will not be the last.

If something later genuinely needs a server, it goes on a subdomain — `demo.vilhelmcarlstrom.com` or similar — and this page is left alone. And nothing touching students goes on this domain at all; that is `Articles/Pedagogical_Model/P4_Ethics_GDPR_Plan.md` and `P4a_Image_Consent_Addendum.md`, and it belongs on institutional infrastructure with the Academy as data controller.
