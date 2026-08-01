/* Event bus for Technodyssey pulse and ready signals */
export const PULSE_EVENT = 'technodyssey:pulse';
export const emitPulse = () => {
    window.dispatchEvent(new CustomEvent(PULSE_EVENT));
};

export const READY_EVENT = 'technodyssey:ready';
export const emitReady = () => {
    window.dispatchEvent(new CustomEvent(READY_EVENT));
};
