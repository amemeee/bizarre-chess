<script setup>
import { CHARS } from '../data/characters'
import { useAuth } from '../composables/useAuth'
import { useStats } from '../composables/useStats'

defineEmits(['login', 'back'])
const { user, cloudEnabled } = useAuth()
const { games, totals, byCharacter, loading } = useStats()
const fmt = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const label = { win: 'Victory', loss: 'Defeat', draw: 'Draw' }
const pct = (c, k) => (byCharacter.value[c]?.played ? (byCharacter.value[c][k] / byCharacter.value[c].played) * 100 : 0)
</script>

<template>
  <section>
    <div class="head">
      <button class="back" @click="$emit('back')">← Back</button>
      <h1>Profile</h1>
    </div>

    <div v-if="!cloudEnabled" class="empty">
      <p>Saving is off. Add your Supabase keys to <code>.env</code> to track your stats.</p>
    </div>
    <div v-else-if="!user" class="empty">
      <p>Sign in to save your games and see your stats.</p>
      <button @click="$emit('login')">Sign in</button>
    </div>
    <template v-else>
      <div class="tiles">
        <div class="tile"><b>{{ totals.played }}</b><span class="caption">Duels</span></div>
        <div class="tile"><b class="w">{{ totals.win }}</b><span class="caption">Victories</span></div>
        <div class="tile"><b class="l">{{ totals.loss }}</b><span class="caption">Defeats</span></div>
        <div class="tile"><b>{{ totals.rate }}<small>%</small></b><span class="caption">Win rate</span></div>
        <div class="tile"><b>{{ totals.ultimates }}</b><span class="caption">Ultimates survived</span></div>
      </div>

      <h3 class="sub caption">Versus</h3>
      <div class="vs">
        <div v-for="c in CHARS" :key="c.id" class="row" :style="{ '--rc': c.glow }">
          <b class="name">{{ c.name }}</b>
          <div class="bar">
            <i class="bw" :style="{ width: pct(c.id, 'win') + '%' }" />
            <i class="bd" :style="{ width: pct(c.id, 'draw') + '%' }" />
            <i class="bl" :style="{ width: pct(c.id, 'loss') + '%' }" />
          </div>
          <span class="rec">{{ byCharacter[c.id]?.win ?? 0 }}W · {{ byCharacter[c.id]?.loss ?? 0 }}L · {{ byCharacter[c.id]?.draw ?? 0 }}D</span>
        </div>
      </div>

      <h3 class="sub caption">Recent duels</h3>
      <p v-if="loading" class="muted">Loading…</p>
      <p v-else-if="!games.length" class="muted">No duels yet.</p>
      <ul v-else class="list">
        <li v-for="g in games.slice(0, 12)" :key="g.id">
          <span class="res" :class="g.result">{{ label[g.result] }}</span>
          <span class="grow">vs {{ CHARS[g.character_id]?.name ?? g.character_id }}</span>
          <span class="muted">{{ g.moves }} moves</span>
          <span class="muted date">{{ fmt(g.created_at) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
section { overflow-y: auto; width: 100%; max-width: 880px; margin: 0 auto; padding: 8px 4px 24px; }
.head { display: flex; align-items: baseline; gap: 20px; margin-bottom: 28px; }
.head h1 { font-size: clamp(36px, 7vh, 60px); }
.back { border: 0; padding: 4px 0; color: var(--muted); font-size: 11px; }
.back:hover:not(:disabled) { background: none; color: var(--text); }
.sub { margin: 36px 0 14px; }
.empty { padding: 48px 24px; text-align: center; display: flex; flex-direction: column; gap: 18px; align-items: center; border: 1px solid var(--line); color: var(--soft); }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); border: 1px solid var(--line); }
.tile { padding: 22px 20px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid var(--line); }
.tile:last-child { border-right: 0; }
.tile b { font-family: var(--serif); font-weight: 900; font-size: 40px; line-height: 1; }
.tile b small { font-size: .5em; margin-left: 2px; color: var(--muted); }
.tile b.w { color: var(--win); } .tile b.l { color: var(--loss); }

.vs { display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; gap: 18px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.name { font-family: var(--serif); font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 18px; color: var(--rc); }
.bar { display: flex; height: 4px; background: rgba(255, 255, 255, .06); }
.bar i { display: block; transition: width .6s; }
.bw { background: var(--win); } .bd { background: var(--muted); } .bl { background: var(--loss); }
.rec { text-align: right; font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: .12em; color: var(--muted); }

.list { list-style: none; padding: 0; }
.list li { display: flex; align-items: center; gap: 18px; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.grow { flex: 1; min-width: 0; color: var(--soft); }
.res { width: 82px; font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
.res.win { color: var(--win); } .res.loss { color: var(--loss); } .res.draw { color: var(--muted); }
.date { width: 56px; text-align: right; }

@media (max-width: 600px) {
  .row { grid-template-columns: 80px 1fr; } .rec { grid-column: 1 / -1; text-align: left; }
  .tile { border-right: 0; border-bottom: 1px solid var(--line); }
}
</style>
