// Import all images as modules so Vite can process them correctly
import portrait from './assets/images/01portrait.jpg'
import thesis01 from './assets/images/academic-work/thesis-01.jpg'
import thesis02 from './assets/images/academic-work/thesis-02.jpg'
import semseg01 from './assets/images/academic-work/semseg-01.jpg'
import semseg02 from './assets/images/academic-work/semseg-02.jpg'
import stitch from './assets/images/selected-projects/stitch.jpg'
import travelcompanion from './assets/images/selected-projects/travelcompanion.jpg'
import navigator from './assets/images/selected-projects/navigator.jpg'
import argps from './assets/images/selected-projects/argps.jpg'

export const images = {
  portrait,
  thesis01,
  thesis02,
  semseg01,
  semseg02,
  stitch,
  travelcompanion,
  navigator,
  argps
}

// Set image sources after DOM loads
export function setImageSources() {
  const imageMap = {
    'portrait': portrait,
    'thesis-01': thesis01,
    'thesis-02': thesis02,
    'semseg-01': semseg01,
    'semseg-02': semseg02,
    'stitch': stitch,
    'travelcompanion': travelcompanion,
    'navigator': navigator,
    'argps': argps
  }

  // Set portrait image
  const portraitImg = document.getElementById('portrait')
  if (portraitImg) {
    portraitImg.src = portrait
  }

  // Set academic work images
  const academicImages = document.querySelectorAll('.ac-wo-image')
  academicImages.forEach(img => {
    const altText = img.alt.toLowerCase()
    if (altText.includes('thesis')) {
      img.src = thesis01
      img.dataset.hoverSrc = thesis02
    } else if (altText.includes('project')) {
      img.src = semseg01
      img.dataset.hoverSrc = semseg02
    }
  })

  // Set selected project images
  const projectImages = document.querySelectorAll('.se-pr-image')
  projectImages.forEach(img => {
    const altText = img.alt.toLowerCase()
    if (altText.includes('stitch') || img.src.includes('stitch')) {
      img.src = stitch
      img.dataset.hoverSrc = stitch
    } else if (altText.includes('travel') || img.src.includes('travel')) {
      img.src = travelcompanion
      img.dataset.hoverSrc = travelcompanion
    } else if (altText.includes('navigator') || img.src.includes('navigator')) {
      img.src = navigator
      img.dataset.hoverSrc = navigator
    } else if (altText.includes('argps') || img.src.includes('argps')) {
      img.src = argps
      img.dataset.hoverSrc = argps
    }
  })
}