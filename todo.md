# HOUSE POKER - TODO

## Database & Backend
- [x] User balance table (real balance, bonus balance, tournament tickets)
- [x] Game tables/rooms table in DB
- [x] Hand history table
- [x] Transaction history table (deposits, withdrawals)
- [x] Admin roles and permissions in DB
- [x] tRPC procedures for balance operations
- [x] tRPC procedures for game state management

## Authentication & Profile
- [x] User profile with avatar selection
- [x] Nickname editing
- [x] Balance display from DB (real, not fake)
- [x] Player statistics (hands played, hands won, win rate, total winnings)
- [x] Game history viewing
- [x] Transaction history viewing

## Game Table - Premium Design
- [x] Premium casino-quality table design (green felt, gold accents)
- [x] AI-generated assets (chips, cards, table, buttons)
- [x] Card dealing animations
- [ ] Chip movement animations
- [x] Win/loss effects (showdown overlay)
- [x] Player seat visibility improvements
- [x] Raise slider for custom bet amounts
- [x] Side pots support (in engine)
- [ ] Split pot support
- [ ] Auto-muck option
- [x] Timer with timebank (30s action timer)
- [ ] Sound effects (fold, call, raise, chips, cards, win)

## Multiplayer & Server
- [x] WebSocket real-time game state sync
- [x] Table management on server (GameManager)
- [ ] Player queue system
- [x] Auto-reconnect on disconnect (60s grace period)
- [x] Game state recovery after disconnect (reconnection logic)

## Cashier / Payments
- [x] Deposit page with amount input and request system
- [x] Withdrawal page with wallet address and amount
- [x] Transaction history
- [x] Balance management through server (buy-in/cash-out)

## Admin Panel
- [x] Admin dashboard with stats
- [x] View all users with balance info
- [x] View player cards at tables (admin panel with real-time card viewing)
- [x] Manage player balances (adjust balance)
- [x] Bot management (auto-fill bots)
- [ ] RNG control
- [ ] User management (ban/mute)
- [x] Transaction logs (approve/reject deposits)
- [x] Game logs (hand history viewer)
- [x] Admin action logs

## Lobby & Navigation
- [x] Table list with player counts from DB
- [x] Table filtering by game type (holdem/omaha)
- [x] Quick play matchmaking
- [ ] Tournament lobby

## AI Bots
- [x] Bot difficulty levels (beginner, medium, pro)
- [x] Bot aggression settings (in pokerEngine)
- [x] Bot bluff frequency (in pokerEngine)
- [x] Bots fill empty seats automatically

## Polish & UX
- [x] All pages use premium dark casino theme
- [ ] No emojis - all custom AI-generated assets
- [x] Smooth page transitions (framer-motion)
- [x] Loading states and skeletons
- [x] Mobile-first responsive design
- [x] Bottom navigation bar

## Critical Issues from User Feedback
- [x] MySQL/DB is connected and working (verified with tests)
- [ ] Push to GitHub regularly
- [x] All buttons must work - no mock/demo buttons
- [x] Balance must be REAL (from DB, not localStorage)
- [x] Deposit/Withdraw must actually work through server
- [x] Avatar selection works (avatar upload via S3 exists)
- [x] Multiplayer must work via WebSocket
- [x] Admin panel must be built and accessible
- [x] Design must be premium casino quality (dark theme, gold accents)
- [x] All images must be custom AI-generated (no emojis, no placeholders)
- [x] Game must be actually playable end-to-end

## Asset Quality Fix
- [x] Regenerate all poker assets with transparent backgrounds (no white bg)
- [x] Replace white-background images with clean transparent PNG assets
- [x] Update assets.ts with new CDN URLs
- [x] Verify all assets display correctly on dark background

## Critical Gameplay Bugs (User Report: "can't even play poker")
- [x] Diagnose and fix all blocking gameplay issues
- [x] Verify full game cycle: join → deal → bet → flop → turn → river → showdown → new hand
- [x] Ensure action buttons always appear when it's your turn
- [x] Ensure cards are always visible
- [x] Ensure balance updates correctly after each hand

## Premium Club Redesign (v3)
- [x] New global theme: ultra-dark luxury with gold/emerald, premium Google Fonts
- [x] Home page: cinematic premium landing with VIP club feel
- [x] Lobby page: sleek premium table cards with live player indicators
- [x] GameTable: premium photorealistic felt, elegant card design, polished HUD
- [x] Full mobile-first responsive across all pages

## Major Fix Pass (User Request: "nothing works")
- [x] Fix poker engine: hands must complete full cycle (preflop→flop→turn→river→showdown→new hand)
- [x] Fix bots: must not get stuck, must play through all streets
- [x] Fix hero cards: always visible when dealt
- [x] Fix action buttons: always show on hero's turn
- [x] Fix timer: must count down correctly and auto-fold
- [x] Fix game progression: new hand must start after showdown
- [x] Fix bot action scheduling: bots must continue playing after hero folds
- [x] Admin panel: bot management (add/remove/configure bots per table)
- [x] Admin panel: view player cards at tables
- [x] Admin panel: table monitoring (live view of all tables)
- [x] Fix mobile responsiveness across all pages
- [ ] Push to GitHub as new version

## Complete Rewrite - Real Poker Engine (v4)
- [x] Real poker engine: proper deck, shuffle, hand evaluation (Royal Flush to High Card)
- [x] Proper betting rounds: preflop, flop, turn, river with correct action validation
- [x] Side pots: multiple all-in scenarios with proper pot splitting
- [ ] Split pots: identical hand rankings
- [x] Rake system: configurable percentage, min/max caps per table
- [x] Rakeback system: configurable return percentage, VIP levels
- [x] Smart bots: beginner/medium/pro with configurable aggression, bluff frequency
- [x] Admin panel: bot management (add/remove/configure bots per table)
- [x] Admin panel: view all player cards in real-time
- [x] Admin panel: table monitoring with live state
- [x] Admin panel: rake/rakeback configuration
- [x] Game manager: proper hand history logging to DB
- [x] Game manager: reconnect handling, auto-fold on timeout
- [x] GameTable UI: work with new engine, show rake taken
- [ ] Push to GitHub as new version
