# vilhelmcarlstrom.com

The holding page. Four files, no build step, no framework, no blog.

	index.html	the page
	style.css	the palette is the feed's; see ../assets/colourmap.py
	field.js	the background, behind one mount() call — the swap point
	og.jpg		the link preview card, rendered by ../assets/render.py

Decided in `../Outreach-Strategy.md` §4 D3 and `../Online-Presence.md`: this is an
**index, not a publication**. Its only maintenance obligation is the record, which
changes rarely. The full site is deferred to M12, gated on T1 out, the first
Kalundborg studio run, and Demonstrator A running.

## Before it ships

- [ ] Confirm the LinkedIn slug matches what is set in the profile settings.
- [ ] Add Google Scholar to the Record row once the profile exists. A dead link is
      worse than an absent one, so it stays commented out until then.

## Deploying

Step by step, with every field named, in `DEPLOY.md`.

## Changing it

Edit the files; push; Netlify redeploys. The record is the only thing expected to
change, and it changes rarely.

`field.js` is deliberately one module behind one entry point. When `nabla-wasm` can
compile and run a `.nabla` graph in a browser — see
`../Nabla-Web-Background_Spec.md` — the inside of that file is replaced and nothing
else moves.

**What this page does not acquire:** a blog, a CMS, a build step, analytics, a
cookie banner, a newsletter, a contact form, or a second model in the background.
Each is a plausible next step and each turns an index into a thing that needs
looking after. If something genuinely needs a server later, it goes on a subdomain
and this page stays as it is.
