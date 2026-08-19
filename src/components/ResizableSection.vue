<script setup lang="ts">
import { computed, ref } from 'vue'

import { clampSectionHeight } from '../data/resizableSection'

const props = withDefaults(
  defineProps<{
    label: string
    initialHeight: number
    minimumHeight?: number
    maximumHeight?: number
  }>(),
  { minimumHeight: 120, maximumHeight: 800 },
)

const height = ref(
  clampSectionHeight(props.initialHeight, props.minimumHeight, props.maximumHeight),
)
let drag: { pointerId: number; startY: number; startHeight: number } | null = null

const contentStyle = computed(() => ({ height: `${height.value}px` }))

function resize(requested: number): void {
  height.value = clampSectionHeight(requested, props.minimumHeight, props.maximumHeight)
}

function pointerDown(event: PointerEvent): void {
  drag = { pointerId: event.pointerId, startY: event.clientY, startHeight: height.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function pointerMove(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return
  resize(drag.startHeight + event.clientY - drag.startY)
}

function pointerUp(event: PointerEvent): void {
  if (drag?.pointerId === event.pointerId) drag = null
}

function keyDown(event: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 40 : 10
  if (event.key === 'ArrowUp') resize(height.value - step)
  else if (event.key === 'ArrowDown') resize(height.value + step)
  else if (event.key === 'Home') resize(props.minimumHeight)
  else resize(props.maximumHeight)
}
</script>

<template>
  <section class="resizable-section">
    <div class="resizable-section__content" :style="contentStyle"><slot /></div>
    <div
      class="resize-handle"
      role="separator"
      tabindex="0"
      aria-orientation="horizontal"
      :aria-label="label"
      :aria-valuemin="minimumHeight"
      :aria-valuemax="maximumHeight"
      :aria-valuenow="Math.round(height)"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
      @keydown="keyDown"
    >
      <span aria-hidden="true" />
    </div>
  </section>
</template>
