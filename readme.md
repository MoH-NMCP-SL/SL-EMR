# EMR Home Page (index.html): Code Explained Line by Line

Ministry of Health, Government of Sierra Leone
Designed by Informatics Consultancy Firm, Sierra Leone (ICF-SL)

## 1. What this file is

`index.html` is the landing page of the Electronic Medical Record (EMR). It is a single self contained file, so the HTML, the styles and the scripts all live inside it, and the Ministry of Health logo is embedded as text so the page needs no image file beside it.

The page has two views that share one address:

1. **Home**, which shows three module cards: Health Facility Registry, Case Based Entry Form and MoH Analytics.
2. **MoH Analytics**, which shows the Ministry of Health organogram. It appears when the address ends in `#moh`, and every programme box in it opens that programme's own pipeline page.

The file is read from top to bottom in this order, and this README follows the same order:

| Part | What it does |
|---|---|
| Head | Page settings, title, font and all the styles |
| First script | Works out the screen view (Phone, Tablet or Computer) before anything is drawn |
| Header | Logo, title, back button, menu button and the menu itself |
| Main | The Home cards and the empty holder for the organogram |
| Footer, frame and note | The fixed footer, the green side frame and the message bubble |
| Second script | Checks that a module page exists before leaving |
| Third script | Makes the screen view choices and the menu work |
| Fourth script | Builds the organogram, draws its lines and switches between the two views |

---

## 2. The head

```html
<!DOCTYPE html>
<html lang="en">
```
The first line tells the browser this is a modern HTML5 page. The second opens the page and declares it is written in English, which helps screen readers and translation tools.

```html
<meta charset="utf-8">
```
This sets the character encoding, so letters, the middle dot in the title and any accented names display correctly.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
This tells a phone to draw the page at the phone's own width with no zoom. `viewport-fit=cover` lets the page use the full screen on phones with a notch. The first script later rewrites this line when the user forces the Tablet or Computer view.

```html
<meta name="theme-color" content="#2c6693">
<meta name="color-scheme" content="light">
```
The first colours the phone's browser bar in the DHIS2 blue. The second tells the browser the page is designed for a light scheme only, so a phone in dark mode will not invert the colours.

```html
<title>Electronic Medical Record (EMR) · Ministry of Health</title>
```
This is the text shown on the browser tab. The script changes it to "MoH Analytics" when the organogram is open.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500;700;900&display=swap" rel="stylesheet">
```
The first line opens the connection to Google Fonts early, which saves time. The second loads the Roboto font in three weights (500, 700 and 900). `display=swap` means text appears straight away in a system font and then switches to Roboto once it arrives, so the page is never blank while offline or on a slow line.

---

## 3. The styles

All the styles sit inside one `<style>` block. They are explained here in the groups they appear in.

### 3.1 Page basics

```css
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*,*::before,*::after{box-sizing:inherit}
```
`box-sizing:border-box` means a box's padding and border are counted inside its width, which makes layouts predictable. The safe area padding keeps content clear of the notch and the home bar on newer phones. The second line passes the same sizing rule to every element.

```css
html{height:100%;scroll-padding-top:env(safe-area-inset-top,0px);background:#eef2f6}
body{margin:0;min-height:100%;background:#eef2f6;color:#0b2540;font:700 15px/1.5 Roboto,...}
```
These give the page its pale grey blue background and dark navy text. The body font is Roboto at weight 700 and 15 pixels, with a line height of 1.5. If Roboto is not available the browser falls back through the system fonts listed after it. `-webkit-text-size-adjust:100%` stops iPhones from enlarging text on their own, and the tap highlight line removes the grey flash when a link is tapped.

```css
.app{max-width:var(--e-appw);margin:0 auto;min-height:100vh;min-height:100dvh;padding-bottom:104px}
```
`.app` is the column that holds everything. Its width comes from the variable `--e-appw`, so it is 560 pixels on a phone, 820 on a tablet and the full width on a computer. It is centred, it fills at least the full screen height (`dvh` is the modern unit that respects the phone's moving address bar), and the bottom padding leaves room so the fixed footer never hides the last card.

```css
main{padding:0 18px}
html:not(.w-p) main{padding-left:24px;padding-right:24px}
html.w-l main{padding-left:12px;padding-right:12px}
```
These set the side margin of the content. The classes `w-p`, `w-t` and `w-l` are placed on the `<html>` tag by the first script and stand for Phone, Tablet and Computer (laptop). So the content has 18 pixels of margin on a phone, 24 on a tablet and 12 on a computer.

### 3.2 The section heading ("Choose a module")

```css
.lh{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#0d47a1;margin:16px 4px 12px}
.lh::after{content:"";flex:1;height:2px;border-radius:2px;background:linear-gradient(90deg,#1565c0,transparent)}
```
The heading is small, heavy, spaced out and in capitals. The `::after` rule draws a thin blue line to the right of the words that fades out towards the edge.

### 3.3 The card grid and the cards

```css
.cards{display:grid;grid-template-columns:1fr;gap:14px}
html:not(.w-p) .cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
html.w-l .cards{grid-template-columns:repeat(3,minmax(0,1fr))}
html.w-l .cards{gap:18px}
```
The cards stack in one column on a phone, sit two across on a tablet and three across on a computer, and the space between them grows slightly with the screen.

```css
.rcard{display:flex;flex-direction:column;height:100%;text-decoration:none;color:#0b2540;background:#fff;border:2px solid var(--c);border-radius:22px;overflow:hidden;transition:transform .12s}
```
Each card is a link styled as a white box with rounded corners. Its border colour comes from `--c`, which every card sets for itself in the HTML, so one rule serves all three colours.

```css
.rcard:active{transform:scale(.985)}
.rcard:hover{box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 40%,transparent)}
.rcard:focus-visible{outline:3px solid #1565c0;outline-offset:3px}
```
When pressed, the card shrinks a little so the tap feels real. On hover it gets a soft glow in its own colour. When reached with the keyboard it gets a clear blue outline, which matters for accessibility.

```css
.rcard .pic{display:grid;place-items:center;aspect-ratio:2/1;background:var(--c)}
.rcard .pic svg{width:34%;max-width:120px;...stroke:#fff;...}
```
`.pic` is the coloured top band of the card, twice as wide as it is tall, with the white line icon centred inside it.

```css
.rcard .tag{...border-radius:999px;background:var(--c);color:#fff;...}
```
The tag is the small rounded label under the band ("Facility registry", "Case based data", "Analytics").

```css
.rcard .rbody{flex:1;display:flex;align-items:center;gap:14px;padding:10px 14px 16px}
.rcard .rt{flex:1;display:flex;flex-direction:column;gap:4px}
.rcard .rt b{font-size:18px;color:#0b2540}
.rcard .rt small{font-size:14px;color:#0d47a1;font-weight:500}
.rcard .go{flex:none;width:40px;height:40px;border-radius:50%;background:var(--c);display:grid;place-items:center}
.rcard .go svg{...stroke:#fff;stroke-width:2.6;...}
```
`.rbody` is the lower part of the card. Inside it, `.rt` holds the bold title and the short description, and `.go` is the round coloured button with a white arrow on the right. `flex:1` on `.rbody` lets every card in a row reach the same height.

### 3.4 Shared EMR colours and widths

```css
:root{--e-dhis:#2c6693;--e-dhis2:#1565c0;--e-dhis3:#0d47a1;--e-ink:#0b2540;--e-line:#cfdbe7;--e-s2:#f7f9fb;--e-frame:#009E73;--e-appw:560px}
html:not(.w-p){--e-appw:820px}
html.w-l{--e-appw:100%}
```
These variables are the design tokens shared with the PHU EMR. `--e-dhis` is the header blue, `--e-dhis2` and `--e-dhis3` are brighter and darker blues, `--e-ink` is the text colour, `--e-line` is the light border colour, `--e-s2` is the hover background and `--e-frame` is the green of the frame. `--e-appw` is the column width, and the next two lines change it for tablet and computer.

### 3.5 The header bar

```css
.e-appbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:1000;display:flex;align-items:center;gap:16px;padding:20px 18px;max-width:var(--e-appw);margin:0 auto;background:var(--e-dhis);border-bottom:6px solid var(--e-frame);...}
```
The header stays stuck to the top while the page scrolls (`sticky`). It is blue with a thick green line underneath, it lines up with the column width, and `z-index:1000` keeps it above the cards.

```css
.e-logo{width:88px;height:88px;border-radius:50%;background:#fff;object-fit:contain;...box-shadow:0 0 0 3px #fff}
```
The logo is shown as a white circle, and the shadow line gives it a white ring.

```css
.e-ctx{flex:1;min-width:0;display:flex;flex-direction:column;text-align:left}
.e-ctx b{color:#fff;font-weight:700;white-space:normal;font-size:clamp(18px,5.2vw,26px);line-height:1.15;...}
.e-ctx small{color:#fff;font-weight:700;font-size:15px;margin-top:4px;opacity:.95}
```
`.e-ctx` holds the page title and "Ministry of Health" under it. It takes the space left between the logo and the buttons. `clamp(18px,5.2vw,26px)` lets the title size follow the screen width while never going below 18 or above 26 pixels.

```css
.e-iconbtn{position:relative;width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.14);border:2px solid #fff;...}
.e-iconbtn svg{width:26px;height:26px;fill:none;stroke:#fff;...}
```
This is the style of the square header buttons (the back arrow and the menu button): a rounded square with a white border and a faint white fill.

```css
.e-menubtn span{display:block;width:24px;height:3px;border-radius:2px;background:#fff;transition:...}
.e-menubtn.open span:nth-child(1){transform:translateY(9px) rotate(45deg)}
.e-menubtn.open span:nth-child(2){opacity:0}
.e-menubtn.open span:nth-child(3){transform:translateY(-9px) rotate(-45deg)}
```
The menu button is drawn from three short white bars. When the menu opens the button gets the class `open`, so the top and bottom bars turn and meet to form an X while the middle bar fades away.

### 3.6 The menu panel

```css
.e-menu{position:absolute;top:calc(100% + 6px);right:12px;width:260px;display:none;...outline:3px solid var(--e-frame);z-index:1001}
.e-menu.open{display:flex;animation:e-drop .16s ease}
@keyframes e-drop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
```
The menu is a white panel just below the header on the right, with a green outline. It is hidden until it has the class `open`, and then it slides down slightly while fading in.

```css
.e-menu button,.e-menu a{display:flex;align-items:center;gap:14px;padding:13px 14px;border-radius:12px;...width:100%}
.e-menu button:hover,.e-menu a:hover{background:var(--e-s2)}
.e-menu .on{background:#e3eef9;color:var(--e-dhis2)}
.e-menu svg{width:24px;height:24px;...stroke:currentColor;...}
.e-menu hr{border:0;border-top:1px solid var(--e-line);margin:4px 6px;width:auto}
```
Each menu row is an icon followed by text. Rows go grey on hover, and the row for the current view (class `on`) is pale blue with blue text. `stroke:currentColor` makes each icon take the colour of its row text. The `hr` is the thin divider under the screen view section.

### 3.7 The older view tabs

```css
.e-vtabs{...}
.e-vtabs button{...}
...
html.w-p .e-vtabs button{font-size:12px;gap:4px}
```
These rules style a row of view tabs used in the PHU EMR. On this page the screen view buttons now live inside the menu (section 3.11), so these rules stay only so the shared chrome looks the same across both apps.

### 3.8 The green frame and the footer

```css
.e-frame{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);width:min(var(--e-appw),100%);border-left:6px solid var(--e-frame);border-right:6px solid var(--e-frame);pointer-events:none;z-index:999}
```
This draws the green borders on both sides of the column from the top of the screen to the bottom. It is centred with `left:50%` and `translateX(-50%)`, it matches the column width, and `pointer-events:none` lets taps pass straight through it.

```css
.e-foot{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(var(--e-appw),100%);z-index:1000;background:var(--e-dhis);color:#fff;...border-top:6px solid var(--e-frame);display:flex;flex-direction:column;...}
.e-foot .f1{font-size:clamp(10px,3.1vw,14px)}
.e-foot .sep{margin:0 .45em}
.e-foot .f2{font-size:clamp(10.5px,3vw,12.5px);white-space:normal;max-width:100%}
```
The footer is fixed to the bottom, blue with a green line on top, and holds two lines: the Ministry line (`f1`) and the ICF-SL credit (`f2`). `.sep` spaces out the vertical bar between "Ministry of Health" and "Government of Sierra Leone".

```css
@media (max-width:360px){ ... }
@media (max-height:500px) and (orientation:landscape){ ... }
@media print{ .e-appbar,.e-vtabs,.e-frame,.e-foot{display:none!important} }
```
The first rule shrinks the logo and buttons on very narrow phones. The second makes the header thinner when a phone is turned on its side. The third hides the header, frame and footer when the page is printed.

### 3.9 Fitting every phone

The block that starts with the comment `fit on every phone` repeats the header sizes at three break points:

1. `max-width:430px` covers most phones. The logo drops to 64 pixels, the buttons to 46 and the title to 20, and the X of the menu button is recalculated because the bars are shorter.
2. `max-width:360px` covers small phones, with a 52 pixel logo and a 17 pixel title.
3. `max-height:500px` in landscape makes the header and the footer slim. The footer's two lines sit side by side instead of stacked, and the menu is limited to the screen height.

The line after that block gives the cards a wider and flatter picture band in landscape, so more of each card fits on screen.

### 3.10 Small screen adjustments

```css
.e-foot .f2{text-wrap:balance}
@media (max-width:380px){ .e-foot .f2{font-size:2.8vw;white-space:nowrap} }
```
`text-wrap:balance` makes the credit line break into lines of even length. On narrow phones the credit is kept on one line and its size follows the screen width.

The next two media blocks fine tune the header again for 430 and 360 pixels. Because they come later in the file, they win over the earlier values.

```css
html.w-p .rcard .pic{aspect-ratio:3/1}
html.w-p .rcard .pic svg{width:22%}
@media (max-height:500px) and (orientation:landscape){ .rcard .pic{aspect-ratio:4/1} .rcard .pic svg{width:14%} }
```
In the Phone view the card picture band becomes flatter (three wide to one high), and in landscape flatter still, so the three cards fit with less scrolling.

### 3.11 The Screen view sub menu

```css
.e-menu .e-subtog{position:relative}
.e-menu .e-subtxt{flex:1;display:flex;flex-direction:column;line-height:1.2}
.e-menu .e-subtxt small{font-size:12.5px;font-weight:700;color:var(--e-dhis2)}
.e-menu .e-chev{width:10px;height:10px;border-right:3px solid currentColor;border-bottom:3px solid currentColor;transform:rotate(45deg);...}
```
"Screen view" is the first row of the menu. Under its name it shows the current choice in small blue text. The chevron is made from a small square with only two borders, turned 45 degrees so it points down.

```css
.e-menu .e-subtog[aria-expanded="true"]{background:#e3eef9;color:var(--e-dhis2)}
.e-menu .e-subtog[aria-expanded="true"] .e-chev{transform:rotate(-135deg);margin:4px 6px 0 0}
```
When the sub menu is open the row turns pale blue and the chevron turns to point up.

```css
.e-menu .e-vlist{display:flex;flex-direction:column;gap:2px;margin:2px 0 4px 22px;padding-left:10px;border-left:3px solid var(--e-line)}
.e-menu .e-vlist[hidden]{display:none}
.e-menu .e-vlist button{padding:10px 12px;font-size:15px}
...
.e-menu .e-vlist button.on{background:var(--e-dhis2);color:#fff}
.e-menu .e-vlist button.on::after{content:"";margin-left:auto;width:6px;height:12px;border:solid #fff;border-width:0 3px 3px 0;transform:rotate(45deg) translate(-2px,-2px)}
.e-menu .e-vlist button.det:not(.on){outline:2px dashed var(--e-dhis2);outline-offset:-2px}
.e-menu{max-height:calc(100dvh - 140px);overflow-y:auto}
```
The four choices (Auto, Phone, Tablet, Computer) are indented with a grey line on their left. The chosen one is solid blue with a white tick on its right, drawn from a rotated two sided border. The size the device really is (class `det`, short for detected) gets a dashed blue outline when it is not the chosen one, so the user can always see which view Auto would pick. The last line stops the menu from running off the bottom of the screen and lets it scroll.

### 3.12 Messages

```css
.e-note{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(...));z-index:1200;...background:#0d47a1;color:#fff;...}
.e-nojs{...background:#fff3cd;...}
a.busy{opacity:.6;cursor:progress}
```
`.e-note` is the dark blue bubble that floats just above the footer, used to say that a page is not on the server yet. `.e-nojs` is the yellow warning shown only when JavaScript is switched off. `a.busy` fades a card while the page check runs.

### 3.13 The organogram

```css
:root{--dhis:#2c6693;--dhis2:#1565c0;--line:#cfdbe7;--ink:#0b2540}
```
Short names for the same colours, used by the organogram rules.

```css
.og{padding:14px 0 20px}
.og-head{...}
```
`.og` wraps the whole organogram. `.og-head` is reserved for a heading block.

```css
.og-box{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:3px;border-radius:12px;padding:12px 14px;color:#fff;background:var(--dhis)}
.og-box b{font-size:19px;font-weight:900;line-height:1.15}
.og-box small{font-size:12.5px;font-weight:700;line-height:1.3;color:#fff}
```
Every filled box (MoH, DPPI and each directorate) shares this shape: blue, rounded, with the short name in large bold and the full name in small text under it.

```css
.og-top{display:flex;flex-direction:column;align-items:center}
.og-moh{background:#1d4568;min-width:min(290px,100%)}
.og-dppi{background:#3a80b8;min-width:min(310px,100%)}
```
The top of the chart stacks MoH above DPPI in the centre. MoH is the darkest blue and DPPI a lighter blue, which shows the level of each office.

```css
.og-down{display:block;width:3px;height:22px;background:var(--dhis);position:relative;margin-bottom:9px}
.og-down::after{content:"";position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);border:8px solid transparent;border-top:10px solid var(--dhis);border-bottom:0}
```
This is the short arrow from MoH down to DPPI. The line is a thin bar, and the arrow head is made by the classic border trick where only the top border has a colour, which leaves a triangle.

```css
.og-cols{display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px}
html.w-t .og-cols{grid-template-columns:repeat(2,minmax(0,1fr))}
html.w-l .og-cols{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:40px}
```
The six directorates sit in one column on a phone, two across on a tablet and all six in one row on a computer.

```css
.og-dir{min-height:84px}
.og-progs{display:flex;flex-direction:column;gap:10px;margin:0 0 0 10px;padding:10px 0 0 16px;border-left:3px solid var(--dhis);position:relative}
```
Each directorate box has a minimum height so boxes in a row line up. Its programmes hang below it with a blue line down their left side, which reads as "these belong to this directorate".

```css
.og-prog{position:relative;display:flex;...min-height:76px;...background:#fff;border:2px solid var(--line);...cursor:pointer;...}
.og-prog::before{content:"";position:absolute;left:-17px;top:50%;transform:translateY(-50%);border:8px solid transparent;border-left:11px solid var(--dhis);border-right:0}
.og-prog b{font-size:17px;font-weight:900;color:var(--dhis);letter-spacing:.3px}
.og-prog small{font-size:13px;font-weight:500;color:var(--ink);line-height:1.3}
```
Each programme is a white clickable box. The `::before` rule draws a small arrow head pointing from the blue line into the box.

```css
.og-prog:hover,.og-prog:focus-visible{border-color:var(--dhis2);box-shadow:...;transform:translateY(-2px);outline:0}
.og-prog:active{transform:scale(.98)}
.og-prog.busy{opacity:.6;cursor:progress}
.og-prog.live{border-color:var(--dhis)}
```
A programme box lifts slightly on hover or keyboard focus, shrinks a little when pressed and fades while its page is being checked. A box marked `live` (NMCP) keeps a blue border to show it is the one fully connected to DHIS2.

```css
.og-note{...}
.og-dev{...}
```
The note under the chart and the "Developed by ICF-SL" line.

```css
.og{position:relative}
.og-lines{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.og-cols{margin-top:30px}
html.w-l .og-progs{margin:0 0 0 10px;padding-left:14px}
```
The connecting lines from DPPI to the directorates are drawn in an SVG layer (`.og-lines`) that sits over the whole chart. `.og` must be `relative` so that layer is positioned against it.

```css
html:not(.w-l) .og-col{background:#fff;border:1px solid var(--line);border-radius:16px;padding:10px}
html:not(.w-l) .og-col.none{padding:10px}
a.og-prog{text-decoration:none;color:inherit}
html.w-l .og-dir{min-height:96px}
.og-msg{...background:#fff3cd;...}
#vMoh[hidden],#vHome[hidden]{display:none}
#ogBackBtn[hidden]{display:none}
```
On phone and tablet each directorate sits in its own white card. Programme links lose the default underline. `.og-msg` is the yellow notice that appears above the chart when a programme page is missing. The last two lines make sure the `hidden` attribute really hides the views and the back button, even though other rules give those elements a display value.

```css
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.app.wide{max-width:var(--e-appw)}
html.w-l .app.wide{max-width:none}
```
The first line again stops a phone from enlarging text when the page is drawn wider than the screen. The other two let the organogram use the whole window, but only in the Computer view.

---

## 4. The first script: choosing the screen view

This script sits right at the top of the body, so the correct view class is on the page before anything is drawn and the layout never jumps.

```js
var DEVICE_W = 0;
function deviceWidth(){
  var vp = document.querySelector('meta[name=viewport]');
  if (!DEVICE_W || (vp && vp.getAttribute('content').indexOf('device-width') > -1)) DEVICE_W = window.innerWidth;
  return DEVICE_W;
}
```
`DEVICE_W` remembers the real width of the device. The width is only read while the viewport line still says `device-width`. Once the page is forced wider (Tablet or Computer on a phone), `window.innerWidth` would report the forced width, so the remembered value is used instead. This keeps Auto honest.

```js
function detectedView(){ var w = deviceWidth(); return w >= 1100 ? 'l' : w >= 700 ? 't' : 'p'; }
```
This turns the width into a view: 1100 pixels or more is Computer (`l`), 700 to 1099 is Tablet (`t`) and anything smaller is Phone (`p`).

```js
var VIEW_PX = { t: 820, l: 1280 };
function setViewport(v){
  var vp = document.querySelector('meta[name=viewport]'); if (!vp) return;
  var want = VIEW_PX[v] && VIEW_PX[v] > deviceWidth() ? 'width=' + VIEW_PX[v] + ', initial-scale=' + (deviceWidth() / VIEW_PX[v]).toFixed(4) + ', viewport-fit=cover'
                                                     : 'width=device-width, initial-scale=1, viewport-fit=cover';
  if (vp.getAttribute('content') !== want) vp.setAttribute('content', want);
}
```
When a user on a small screen picks Tablet or Computer, this rewrites the viewport line so the page is drawn 820 or 1280 pixels wide and then scaled down to fit the screen exactly. For example, a 400 pixel phone in Computer view gets a scale of 400 divided by 1280. If the screen is already wide enough, or the choice is Phone, the normal device width line is used. The line is only written when it actually changes, which avoids needless redraws.

```js
function viewChoice(){ try { return localStorage.getItem('phu_emr_view') || 'auto'; } catch(e){ return 'auto'; } }
```
This reads the user's saved choice from browser storage under the key `phu_emr_view`. The PHU EMR uses the same key, so one choice applies to both apps. If storage is blocked (a private window, for instance), the `try` and `catch` fall back to Auto.

```js
function applyView(){
  var c = viewChoice(), v = c === 'auto' ? detectedView() : c, h = document.documentElement;
  h.classList.remove('w-p','w-t','w-l'); h.classList.add('w-' + v);
  setViewport(c === 'auto' ? 'p' : v);
```
`c` is the saved choice and `v` is the view actually used (the detected one when the choice is Auto). The old view class is removed from `<html>` and the new one added, which switches all the CSS rules in section 3. With Auto the viewport always stays at the device's own width.

```js
  var tabs = document.getElementById('vtabs');
  if (tabs){
    tabs.querySelectorAll('[data-vw]').forEach(function(b){ b.classList.toggle('on', b.dataset.vw === c); b.classList.toggle('det', b.dataset.vw === detectedView()); b.setAttribute('aria-selected', b.dataset.vw === c); });
    document.getElementById('vtauto').textContent = { p:'Phone', t:'Tablet', l:'Computer' }[detectedView()];
    var now = document.getElementById('eViewNow');
    if (now) now.textContent = c === 'auto' ? 'Auto (' + { p:'Phone', t:'Tablet', l:'Computer' }[detectedView()] + ')' : { p:'Phone', t:'Tablet', l:'Computer' }[c];
  }
}
applyView();
```
When the menu exists, each view button gets `on` if it is the chosen one and `det` if it matches the device. `aria-selected` tells screen readers which is chosen. The small text under Auto shows what Auto currently means, and the line under "Screen view" shows the current choice, for example "Auto (Phone)". On this first run the menu is not on the page yet, so only the class and the viewport are set, and the call is repeated later once the menu exists.

---

## 5. The page body

### 5.1 The header

```html
<div class="app" id="app">
<header class="e-appbar">
  <img class="e-logo" src="data:image/jpeg;base64,..." alt="Ministry of Health logo">
```
`.app` opens the main column. The logo is a JPEG written out as base64 text inside the `src`, so the page carries its own logo and works without a separate image file. The `alt` text describes it for screen readers.

```html
  <div class="e-ctx"><b id="hdTitle">Electronic Medical Record (EMR)</b><small>Ministry of Health</small></div>
```
The title and subtitle. The `id` lets the script change the title to "MoH Analytics".

```html
  <a class="e-iconbtn" id="ogBackBtn" href="#" ... hidden><svg ...><path d="M15 18l-6-6 6-6"/></svg></a>
```
The back arrow button. It starts hidden and only appears on the organogram view.

```html
  <button class="e-iconbtn e-menubtn" id="eMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="eMenu"><span></span><span></span><span></span></button>
```
The menu button with its three bars. `aria-expanded` tells screen readers whether the menu is open, and `aria-controls` names the menu it opens.

### 5.2 The menu

```html
<nav class="e-menu" id="eMenu" aria-label="Main menu">
  <button type="button" class="e-subtog" id="eViewTog" aria-expanded="false" aria-controls="vtabs">...Screen view<small id="eViewNow"></small>...</button>
  <div class="e-vlist" id="vtabs" role="tablist" aria-label="Screen view" hidden>
    <button data-vw="auto" role="tab">...Auto<small id="vtauto"></small></button>
    <button data-vw="p" role="tab">...Phone</button>
    <button data-vw="t" role="tab">...Tablet</button>
    <button data-vw="l" role="tab">...Computer</button>
  </div>
  <hr>
```
The first row is the Screen view toggle, followed by its hidden list of four choices. Each choice carries its code in `data-vw`, which the scripts read. The empty `small` tags are filled in by `applyView()`.

```html
  <a href="#" class="on" id="mnHome">...Home</a>
  <a href="facility_register/facility_register.html">...Health Facility Registry</a>
  <a href="phu_emr/phu_emr.html">...Case Based Entry Form</a>
  <a href="#moh" id="mnMoh">...MoH Analytics</a>
</nav>
</header>
```
The four navigation rows. Home starts highlighted. The two module links point into their folders, and MoH Analytics simply adds `#moh` to the address.

### 5.3 The main area

```html
<main id="main">
<section id="vHome">
  <div class="lh" style="margin-top:16px">Choose a module</div>
  <div class="cards">
```
The Home view opens with the section heading and the card grid.

```html
    <a class="rcard" href="facility_register/facility_register.html" data-page style="--c:#0072B2">
      <span class="pic"><svg ...>...</svg></span>
      <span class="tag">Facility registry</span>
      <span class="rbody"><span class="rt"><b>Health Facility Registry</b><small>Facilities, staff, transfers and DHIS2 org units from the Health Facility Register</small></span>
      <span class="go"><svg ...><path d="M9 6l6 6-6 6"/></svg></span></span>
    </a>
```
Each card is one link with four parts: the coloured band with its icon, the tag, the title with its description, and the round arrow. `style="--c:#0072B2"` gives this card its blue. The second card uses green (`#009E73`) and the third orange (`#D55E00`). These three are from the Okabe Ito palette, which stays readable for people with colour blindness. `data-page` marks a card that opens a separate page.

The third card links to `#moh`, so it switches to the organogram on the same page instead of loading a new one.

```html
  </div>
</section>
<section id="vMoh" hidden><div id="ogRoot"></div></section>
</main>
</div>
```
`vMoh` is the empty holder for the organogram. It starts hidden, and the script fills `ogRoot`.

### 5.4 Footer, frame, note and fallback

```html
<footer class="e-foot"><span class="f1">Ministry of Health <span class="sep">|</span> Government of Sierra Leone</span><span class="f2">Designed by Informatics Consultancy Firm – Sierra Leone (ICF-SL)</span></footer>
<div class="e-frame" aria-hidden="true"></div>
<div class="e-note" id="eNote" role="status" aria-live="polite" hidden></div>
<noscript><p class="e-nojs">JavaScript is switched off: ...</p></noscript>
```
The footer with its two lines, the green frame (hidden from screen readers because it is only decoration), the message bubble (`aria-live` makes screen readers announce it when it appears) and the warning shown only when JavaScript is off.

---

## 6. The second script: checking a module page before leaving

```js
(function(){
  var note = document.getElementById('eNote'), t;
  function say(msg){ note.textContent = msg; note.hidden = false; clearTimeout(t); t = setTimeout(function(){ note.hidden = true; }, 4500); }
```
The whole script is wrapped in a function that runs at once, so its names do not clash with others. `say()` shows a message in the bubble and hides it again after 4.5 seconds. `clearTimeout` resets the timer if a second message comes in quickly.

```js
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
```
One listener on the whole document catches every click. `closest` finds the link that was clicked, even when the tap landed on its icon or text. If there is no link, or the user is opening it in a new tab or window with Ctrl, Cmd or Shift, the script steps aside.

```js
    var href = a.getAttribute('href');
    if (!/\.html$/.test(href) || /^(https?:)?\/\//.test(href) || href === 'index.html') return;
```
Only links to local `.html` pages are checked. Links to other websites, links to `#moh` and links back to this page are left alone.

```js
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (!navigator.onLine) return;
```
If the page was opened straight from a folder on the computer, or the device is offline, the check cannot work, so the link is simply followed.

```js
    e.preventDefault();
    a.classList.add('busy');
    fetch(href, { method: 'HEAD', cache: 'no-store' }).then(function(r){
      a.classList.remove('busy');
      if (r.ok) location.href = href;
      else say('This page is not on the server yet: ' + href);
    }).catch(function(){ a.classList.remove('busy'); location.href = href; });
  });
})();
```
The normal navigation is stopped and the card fades. A `HEAD` request asks the server whether the page exists without downloading it, and `no-store` makes sure the answer is fresh. If the page is there the browser goes to it. If not, the bubble says the page is not on the server yet, so the user never lands on a blank error page. If the request itself fails, the link is followed anyway.

---

## 7. The third script: screen view and menu

```js
document.getElementById('vtabs').onclick = function(e){ var b = e.target.closest('[data-vw]'); if (!b) return;
  try { localStorage.setItem('phu_emr_view', b.dataset.vw); } catch(x){} applyView(); };
```
Clicking a view choice saves it under `phu_emr_view` and applies it straight away.

```js
window.addEventListener('resize', applyView);
applyView();
```
The view is applied again whenever the window changes size (for example when a tablet is turned), and once now that the menu exists, so the labels and ticks are filled in.

```js
var mb = document.getElementById('eMenuBtn'), mn = document.getElementById('eMenu');
if (mb && mn){
  mb.onclick = function(e){ e.stopPropagation(); var o = !mn.classList.contains('open'); mn.classList.toggle('open', o); mb.classList.toggle('open', o); mb.setAttribute('aria-expanded', o); };
```
The menu button opens the menu when it is closed and closes it when it is open. It turns the bars into an X and updates `aria-expanded`. `stopPropagation` stops this same click from reaching the next listener, which would close the menu again.

```js
  document.addEventListener('click', function(e){ if (!mn.contains(e.target)) { mn.classList.remove('open'); mb.classList.remove('open'); mb.setAttribute('aria-expanded', false); } });
```
A click anywhere outside the menu closes it.

```js
  var tog = document.getElementById('eViewTog'), vl = document.getElementById('vtabs');
  if (tog && vl) tog.onclick = function(){ var o = vl.hidden; vl.hidden = !o; tog.setAttribute('aria-expanded', o); };
```
The Screen view row opens and closes its list of four choices.

```js
  mn.addEventListener('click', function(e){ var t = e.target.closest('button,a'); if (t && t !== tog) { mn.classList.remove('open'); mb.classList.remove('open'); if (vl){ vl.hidden = true; tog.setAttribute('aria-expanded', false); } } });
}
```
Choosing any item in the menu, apart from the Screen view toggle itself, closes the menu and folds the sub menu back up, so the menu is tidy the next time it opens.

---

## 8. The fourth script: the MoH Analytics organogram

### 8.1 The data

```js
var MOH_TREE = [
  ['DPC', 'Directorate of Disease Prevention and Control', [['NMCP','National Malaria Control Programme','Malaria'], ...]],
  ...
  ['DHRH', 'Directorate of Human Resource for Health', []]
];
```
The whole organogram is described in this one list, so changing the chart means changing data rather than HTML. Each directorate has three parts: its short name, its full name and its list of programmes. Each programme also has three parts: its short name, its full name and the name of its folder. DHRH has an empty list, so it shows with no programmes.

```js
var PROG_LIVE = ['NMCP'];
```
The programmes listed here get the `live` border. At present only NMCP is fully configured and connected to DHIS2.

```js
function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', ... }[c]; }); }
```
`esc()` makes any text safe before it is placed into HTML, by turning characters such as `<` and `&` into their safe forms. This protects the page if a name ever contains those characters.

### 8.2 Building the chart

```js
function drawOg(){
  var root = document.getElementById('ogRoot');
  root.innerHTML = '<div class="og">' +
    '<div class="og-msg" id="ogMsg" hidden></div>' +
```
`drawOg()` builds the chart as one string of HTML and places it in `ogRoot`. It starts with the hidden yellow message box.

```js
    '<div class="og-top"><div class="og-box og-moh"><b>MoH</b><small>Ministry of Health, Sierra Leone</small></div>' +
      '<i class="og-down" aria-hidden="true"></i>' +
      '<div class="og-box og-dppi"><b>DPPI</b><small>Directorate of Policy, Planning and Information</small></div></div>' +
```
Then the top of the chart: MoH, the arrow and DPPI.

```js
    '<div class="og-cols">' + MOH_TREE.map(function(d){
      return '<section class="og-col' + (d[2].length ? '' : ' none') + '">' +
        '<div class="og-box og-dir"><b>' + esc(d[0]) + '</b><small>' + esc(d[1]) + '</small></div>' +
```
For each directorate in `MOH_TREE` it makes a column. A directorate with no programmes gets the class `none`. The directorate box shows the short and full names.

```js
        (d[2].length ? '<div class="og-progs">' + d[2].map(function(p){
          return '<a class="og-prog' + (PROG_LIVE.indexOf(p[0]) > -1 ? ' live' : '') + '" href="' + esc(d[0]) + '/' + esc(p[2]) + '/index.html" data-prog="' + esc(p[0]) + '">' +
            '<b>' + esc(p[0]) + '</b><small>' + esc(p[1]) + '</small></a>'; }).join('') + '</div>' : '') +
      '</section>'; }).join('') + '</div>' +
```
If the directorate has programmes, each one becomes a link. The link address is built as directorate folder, then programme folder, then `index.html`. For NMCP that gives `DPC/Malaria/index.html`. Programmes in `PROG_LIVE` get the `live` class, and `data-prog` keeps the short name for use in messages.

```js
    '<svg class="og-lines" aria-hidden="true"></svg>' +
    '<p class="og-note">Six directorates. <b>NMCP</b>, under <b>DPC</b>, is fully configured ...</p>' +
    '<p class="og-dev">Developed by ICF-SL</p></div>';
  ogLines();
}
```
Finally it adds the empty SVG layer for the lines, the note and the credit, and then calls `ogLines()` to draw the lines.

### 8.3 Drawing the connector lines

```js
function ogLines(){
  var og = document.querySelector('.og'), svg = og && og.querySelector('.og-lines'); if (!svg) return;
  var R = og.getBoundingClientRect();
  function rel(el){ var r = el.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; }
```
The lines are drawn from where the boxes really are on screen, so they stay correct at every screen size. `R` is the position of the whole chart, and `rel()` gives the position of any box measured from the top left corner of the chart.

```js
  var dppi = rel(og.querySelector('.og-dppi')), dirs = Array.prototype.map.call(og.querySelectorAll('.og-dir'), rel);
  svg.setAttribute('width', R.width); svg.setAttribute('height', R.height); svg.setAttribute('viewBox', '0 0 ' + R.width + ' ' + R.height);
```
It measures the DPPI box and every directorate box, then sizes the SVG layer to cover the whole chart.

```js
  var C = '#2c6693', x0 = dppi.x + dppi.w / 2, y0 = dppi.y + dppi.h, h = '';
  function arrow(x, y){ return '<path d="M' + (x - 8) + ' ' + (y - 11) + 'L' + (x + 8) + ' ' + (y - 11) + 'L' + x + ' ' + y + 'z" fill="' + C + '"/>'; }
  function line(a, b, c, d){ return '<path d="M' + a + ' ' + b + 'L' + c + ' ' + d + '" stroke="' + C + '" stroke-width="3" fill="none"/>'; }
```
`C` is the line colour. `x0` and `y0` mark the middle of the bottom edge of DPPI, where the lines start. `arrow()` draws a small filled triangle whose point is at `x, y`, and `line()` draws a straight line between two points.

```js
  var row = dirs.filter(function(d){ return Math.abs(d.y - dirs[0].y) < 4; });
  if (row.length > 1 && row.length === dirs.length){
    var top = row[0].y, yb = y0 + (top - y0) / 2;
    h += line(x0, y0, x0, yb) + line(row[0].x + row[0].w / 2, yb, row[row.length - 1].x + row[row.length - 1].w / 2, yb);
    row.forEach(function(d){ var x = d.x + d.w / 2; h += line(x, yb, x, top - 10) + arrow(x, top); });
```
This checks whether all six directorates sit in one row, which happens in the Computer view. If they do, it draws a proper tree: one line down from DPPI to a level halfway to the directorates, one long line across from the first directorate to the last, and then a short line with an arrow down into each directorate.

```js
  } else if (dirs.length){
    var t2 = og.querySelector('.og-col').getBoundingClientRect().top - R.top;
    h += line(x0, y0, x0, t2 - 10) + arrow(x0, t2);
  }
  svg.innerHTML = h;
}
```
If the directorates are stacked (phone) or in two columns (tablet), a tree would cross the boxes, so a single arrow is drawn from DPPI down to the first directorate block. The finished drawing is then placed in the SVG layer.

```js
drawOg();
window.addEventListener('resize', ogLines);
if (window.ResizeObserver) new ResizeObserver(ogLines).observe(document.querySelector('.og'));
```
The chart is built once. The lines are redrawn when the window changes size, and also whenever the chart itself changes size (for instance when fonts finish loading), using `ResizeObserver` where the browser supports it.

### 8.4 Switching between Home and MoH Analytics

```js
function route(){
  var moh = location.hash === '#moh';
  document.getElementById('vHome').hidden = moh;
  document.getElementById('vMoh').hidden = !moh;
  document.getElementById('ogBackBtn').hidden = !moh;
  document.getElementById('app').classList.toggle('wide', moh);
  document.getElementById('hdTitle').textContent = moh ? 'MoH Analytics' : 'Electronic Medical Record (EMR)';
  document.getElementById('mnHome').classList.toggle('on', !moh);
  document.getElementById('mnMoh').classList.toggle('on', moh);
  document.title = (moh ? 'MoH Analytics' : 'Electronic Medical Record (EMR)') + ' · Ministry of Health';
  window.scrollTo(0, 0);
  if (moh) requestAnimationFrame(ogLines);
}
```
`route()` decides what to show from the end of the address. When it is `#moh`, the Home cards are hidden, the organogram and the back button are shown, the column is allowed to widen, the header and tab titles change, and the matching menu row is highlighted. When it is not, everything goes back. The page scrolls to the top, and on the organogram the lines are drawn on the next frame, after the chart has become visible and can be measured.

```js
document.getElementById('ogBackBtn').onclick = function(e){ e.preventDefault(); history.pushState('', '', location.pathname + location.search); route(); };
document.getElementById('mnHome').onclick = function(e){ e.preventDefault(); history.pushState('', '', location.pathname + location.search); route(); };
```
The back button and the Home menu row remove `#moh` from the address without reloading the page, add a step to the browser history, and show Home again.

```js
window.addEventListener('hashchange', route);
route();
```
Whenever the address changes (a click on the MoH Analytics card, or the phone's own back button) the right view is shown. It is also called once at load, so a link that already ends in `#moh` opens straight on the organogram.

### 8.5 Checking a programme page

```js
document.getElementById('ogRoot').addEventListener('click', function(e){
  var a = e.target.closest('a.og-prog'); if (!a) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (!navigator.onLine) return;
  e.preventDefault(); e.stopPropagation();
```
This works like the page check in section 6, but only for programme boxes. The final `true` in the listener makes it run first (in the capture phase), and `stopPropagation` stops the general page check from running a second time.

```js
  var href = a.getAttribute('href'), msg = document.getElementById('ogMsg');
  a.classList.add('busy');
  fetch(href, { method: 'HEAD', cache: 'no-store' }).then(function(r){
    a.classList.remove('busy');
    if (r.ok){ location.href = href; return; }
    msg.innerHTML = '<b>' + esc(a.dataset.prog) + '</b>: its page is not on the server yet (' + esc(href) + ').';
    msg.hidden = false; msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }).catch(function(){ a.classList.remove('busy'); location.href = href; });
}, true);
```
If the programme's `index.html` exists the browser opens it. If not, the yellow box above the chart names the programme and the missing address, and the page scrolls gently so the message is in view.

---

## 9. Folder layout the page expects

Folder and file names are case sensitive on the server.

```
index.html
facility_register/
    facility_register.html
phu_emr/
    phu_emr.html
DPC/
    Malaria/index.html
    HIV/index.html
    TB/index.html
    NTD/index.html
RCH-N/
    EPI/index.html
    CHP/index.html
    FP/index.html
    Nutrition/index.html
DPHC/
    CHW/index.html
    HE/index.html
    EYE/index.html
DPS/
    NMSA/index.html
    LMIS/index.html
DHS/
    Hospital/index.html
    NEMS/index.html
    LAB/index.html
```

Any folder not yet uploaded simply shows the "not on the server yet" message instead of an error page.

## 10. Common changes

**Add a programme.** Add a line to the right directorate in `MOH_TREE`, for example `['MH','Mental Health Programme','MentalHealth']`, then upload `DPHC/MentalHealth/index.html`.

**Mark a programme as connected.** Add its short name to `PROG_LIVE`, for example `var PROG_LIVE = ['NMCP','EPI'];`, and update the sentence in `.og-note` to match.

**Add a module card.** Copy one `<a class="rcard">` block in the Home section, change its `href`, its colour in `--c`, its icon, tag, title and description, and add the matching link to the menu.

**Reset the screen view.** The choice is stored in the browser under `phu_emr_view`. Choosing Auto in the menu resets it, and clearing the site data in the browser removes it.
