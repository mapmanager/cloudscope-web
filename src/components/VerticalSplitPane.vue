<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { clampSplitSize } from '../data/splitPane'

const props = withDefaults(
  defineProps<{
    label: string
    initialPrimaryRatio?: number
    minimumPrimary?: number
    minimumSecondary?: number
  }>(),
  { initialPrimaryRatio: 0.4, minimumPrimary: 100, minimumSecondary: 160 },
)

const container = ref<HTMLDivElement | null>(null)
const primarySize = ref(0)
let observer: ResizeObserver | null = null
let drag: { pointerId: number; startY: number; startSize: number } | null = null

const gridStyle = computed(() => ({
  gridTemplateRows: `${primarySize.value}px var(--splitter-size) minmax(${props.minimumSecondary}px, 1fr)`,
}))

function availableHeight(): number {
  return Math.max(0, (container.value?.clientHeight ?? 0) - 6)
}

function resize(requested: number): void {
  primarySize.value = clampSplitSize(
    requested,
    availableHeight(),
    props.minimumPrimary,
    props.minimumSecondary,
  )
}

function initialize(): void {
  const available = availableHeight()
  if (!available) return
  resize(primarySize.value || available * props.initialPrimaryRatio)
}

function pointerDown(event: PointerEvent): void {
  drag = { pointerId: event.pointerId, startY: event.clientY, startSize: primarySize.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function pointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  resize(drag.startSize + event.clientY - drag.startY)
}

function pointerUp(event: PointerEvent): void {
  if (drag?.pointerId === event.pointerId) drag = null
}

function keyDown(event: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 40 : 10
  if (event.key === 'ArrowUp') resize(primarySize.value - step)
  else if (event.key === 'ArrowDown') resize(primarySize.value + step)
  else if (event.key === 'Home') resize(props.minimumPrimary)
  else resize(availableHeight() - props.minimumSecondary)
}

onMounted(async () => {
  await nextTick()
  initialize()
  observer = new ResizeObserver(initialize)
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="container" class="vertical-split-pane" :style="gridStyle">
    <div class="split-pane split-pane--primary"><slot name="primary" /></div>
    <div
      class="splitter"
      role="separator"
      tabindex="0"
      aria-orientation="horizontal"
      :aria-label="label"
      :aria-valuenow="Math.round(primarySize)"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
      @keydown="keyDown"
    >
      <span aria-hidden="true" />
    </div>
    <div class="split-pane split-pane--secondary"><slot name="secondary" /></div>
  </div>
</template>
