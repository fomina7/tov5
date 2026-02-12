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
- [ ] AI-generated assets (chips, cards, table, buttons)
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
- [ ] Game state recovery after disconnect

## Cashier / Payments
- [x] Deposit page with amount input and request system
- [x] Withdrawal page with wallet address and amount
- [x] Transaction history
- [x] Balance management through server (buy-in/cash-out)

## Admin Panel
- [x] Admin dashboard with stats
- [x] View all users with balance info
- [ ] View player cards at tables (admin_view_table event exists)
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
- [ ] All images must be custom AI-generated (no emojis, no placeholders)
- [x] Game must be actually playable end-to-end
