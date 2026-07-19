const toast = document.querySelector('.toast')
const toastClose = toast?.querySelector('button')
let toastTimer

function showDownloadHelp() {
  if (!toast) return
  toast.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.hidden = true
  }, 9000)
}

document.querySelectorAll('.button-download').forEach((link) => {
  link.addEventListener('click', showDownloadHelp)
})

toastClose?.addEventListener('click', () => {
  toast.hidden = true
})

document.querySelectorAll('.copy-button').forEach((button) => {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      const label = button.querySelector('span')
      if (!label) return
      label.textContent = 'Copied'
      window.setTimeout(() => {
        label.textContent = 'Copy'
      }, 1800)
    } catch {
      window.prompt('Copy this command', value)
    }
  })
})
