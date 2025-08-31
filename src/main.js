import * as THREE from 'three'
import ThreeGlobe from 'three-globe'

let scene, camera, renderer, globe, controls
let isDragging = false
let momentum = { x: 0, y: 0 }
let cooldownTimer = 0
let isResetting = false
let resetTarget = { x: 0.5, y: -0.3, z: 0 }
let resetStartRotation = { x: 0, y: 0, z: 0 }
let resetProgress = 0
let showGrid = false
let countriesData = null
let raycaster = null
let selectedCountry = null
let countryGuessStatus = 'none' // 'none', 'waiting', 'correct', 'incorrect'
let countryStates = new Map() // Store persistent states for each country

function init() {
  // Setup scene
  scene = new THREE.Scene()
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
  scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI)
  directionalLight.position.set(-1, 0.5, -1)
  scene.add(directionalLight)

  // Setup renderer
  const appElement = document.querySelector('#app')
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(appElement.clientWidth, appElement.clientHeight)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setClearColor(0x000011)
  appElement.appendChild(renderer.domElement)
  //document.getElementById('globeViz').appendChild(renderer.domElement);
  
  // Setup camera
  camera = new THREE.PerspectiveCamera(
    75,
    appElement.clientWidth / appElement.clientHeight,
    0.1,
    1000
  )
  camera.position.z = 300
  
  // Initialize raycaster for click detection
  raycaster = new THREE.Raycaster()
}

function createGlobe() {
  fetch('./src/ne_110m_admin_0_countries.geojson') //'./src/ne_50m_admin_0_countries.json'
    .then(res => res.json())
    .then(countries => {
      // Store countries data for click detection
      countriesData = countries
      globe = new ThreeGlobe()
        .globeMaterial(new THREE.MeshPhongMaterial({ 
          transparent: true, 
          opacity: 0.8 
        }))
        .polygonsData(countries.features)
        .polygonCapColor(getCountryColor)
        .polygonSideColor(() => 'transparent') 
        .polygonStrokeColor(() => '#ffffff')
        .polygonAltitude(0.008)
        .showGraticules(showGrid)      
      scene.add(globe)

      // Print out all information for Germany
      const germanyData = countries.features.find(country => 
        country.properties && country.properties.ADMIN === 'Germany'
      )
      
      if (germanyData) {
        console.log('=== GERMANY COUNTRY DATA ===')
        console.log('Full country object:', germanyData)
        console.log('Properties:', germanyData.properties)
        console.log('Geometry:', germanyData.geometry)
        console.log('Type:', germanyData.type)
        console.log('ID:', germanyData.id)
        console.log('=== END GERMANY DATA ===')
      } else {
        console.log('Germany not found in countries data')
      }

      /*
      const CLOUDS_IMG_URL = './src/clouds.png'
      const CLOUDS_ALT = 0.01
      const CLOUDS_ROTATION_SPEED = -0.008

      const clouds = new THREE.Mesh(new THREE.SphereGeometry(globe.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75))
      new THREE.TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
        clouds.material = new THREE.MeshLambertMaterial({ 
          map: cloudsTexture,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      })

      globe.add(clouds)

      function rotateClouds() {
        clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180
        requestAnimationFrame(rotateClouds)
      }
      rotateClouds()
      */
    })
}

function addControls() {
  let previousMousePosition = { x: 0, y: 0 }
  let velocity = { x: 0, y: 0 }
  let isMouseOverGlobe = false
  let dragDistance = 0
  
  // Check if mouse is over the globe
  function updateMouseOverGlobe(event) {
    if (!globe || !camera) return
    
    const rect = renderer.domElement.getBoundingClientRect()
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    
    const intersects = raycaster.intersectObject(globe, true)
    isMouseOverGlobe = intersects.length > 0
  }
  
  // Function to handle country clicks
  function handleCountryClick(event) {
    if (!globe || !camera || !raycaster || !countriesData) return
    
    const rect = renderer.domElement.getBoundingClientRect()
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(globe, true)
    
    if (intersects.length > 0) {
      const intersectedPoint = intersects[0].point.clone()
      
      // Apply inverse of globe's rotation to get the original coordinate
      const inverseMatrix = new THREE.Matrix4()
      inverseMatrix.copy(globe.matrixWorld).invert()
      intersectedPoint.applyMatrix4(inverseMatrix)
      
      // Get the globe radius (default is 100 for three-globe)
      const globeRadius = 100
      
      // Convert 3D point to lat/lng using Three.js Spherical coordinates
      const spherical = new THREE.Spherical()
      spherical.setFromVector3(intersectedPoint)
      
      // Convert spherical to lat/lng (phi is polar angle from Y-axis, theta is azimuthal angle)
      const lat = (Math.PI / 2 - spherical.phi) * 180 / Math.PI  // Convert from polar angle to latitude
      const lng = (spherical.theta) * 180 / Math.PI             // Convert azimuthal angle to longitude
      
      // Normalize longitude to [-180, 180] range
      const normalizedLng = ((lng + 180) % 360) - 180
      
      console.log(`Clicked at: lat=${lat.toFixed(3)}, lng=${normalizedLng.toFixed(3)}`)
      
      // Find the country that contains this point
      const clickedCountry = findCountryByLatLng(lat, normalizedLng)
      
      if (clickedCountry) {
        console.log(`Found country: ${clickedCountry.properties.NAME || clickedCountry.properties.ADMIN}`)
        selectCountry(clickedCountry)
      } else {
        console.log('No country found at this location')
        //hideCountryInfo()
        hideGuessContainer()
        // Reset current selection but keep persistent states
        selectedCountry = null
        countryGuessStatus = 'none'
        globe.polygonCapColor(getCountryColor)
      }
    } else {
      //hideCountryInfo()
      hideGuessContainer()
      // Reset current selection but keep persistent states
      selectedCountry = null
      countryGuessStatus = 'none'
      globe.polygonCapColor(getCountryColor)
    }
  }
  
  // Helper function to find country by lat/lng coordinates
  function findCountryByLatLng(lat, lng) {
    if (!countriesData) return null
    
    // First try exact point-in-polygon matching
    for (const feature of countriesData.features) {
      if (isPointInCountry(lat, lng, feature)) {
        return feature
      }
    }
    
    // If no exact match, find the closest country within a reasonable distance
    let closestCountry = null
    let minDistance = Infinity
    const maxDistance = 5 // degrees
    
    for (const feature of countriesData.features) {
      const distance = getDistanceToCountry(lat, lng, feature)
      if (distance < minDistance && distance < maxDistance) {
        minDistance = distance
        closestCountry = feature
      }
    }
    
    return closestCountry
  }
  
  // Calculate approximate distance from point to country centroid
  function getDistanceToCountry(lat, lng, feature) {
    const bbox = feature.bbox
    if (!bbox) return Infinity
    
    // Calculate centroid from bounding box
    const centroidLat = (bbox[1] + bbox[3]) / 2
    const centroidLng = (bbox[0] + bbox[2]) / 2
    
    // Simple distance calculation
    const dLat = lat - centroidLat
    const dLng = lng - centroidLng
    return Math.sqrt(dLat * dLat + dLng * dLng)
  }
  
  // Check if a point is inside a country's geometry
  function isPointInCountry(lat, lng, feature) {
    const geometry = feature.geometry
    
    if (geometry.type === 'Polygon') {
      return isPointInPolygon(lat, lng, geometry.coordinates)
    } else if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some(polygon => isPointInPolygon(lat, lng, polygon))
    }
    return false
  }
  
  // Point-in-polygon test using ray casting algorithm with improved handling
  function isPointInPolygon(lat, lng, coordinates) {
    const polygon = coordinates[0] // Use exterior ring
    let inside = false
    
    // Handle longitude wrapping issues
    const normalizedLng = ((lng + 180) % 360) - 180
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i][0], yi = polygon[i][1]
      let xj = polygon[j][0], yj = polygon[j][1]
      
      // Handle longitude wrapping for polygon edges
      xi = ((xi + 180) % 360) - 180
      xj = ((xj + 180) % 360) - 180
      
      // Handle 180/-180 longitude boundary crossings
      if (Math.abs(xi - xj) > 180) {
        if (xi > 0) xi -= 360
        else if (xj > 0) xj -= 360
      }
      
      if (((yi > lat) !== (yj > lat)) && 
          (normalizedLng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    
    return inside
  }
  
  renderer.domElement.addEventListener('mousedown', (event) => {
    isDragging = true
    dragDistance = 0
    previousMousePosition = { x: event.clientX, y: event.clientY }
  })
  
  renderer.domElement.addEventListener('mousemove', (event) => {
    updateMouseOverGlobe(event)
    
    if (isDragging && globe) {
      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      }
      
      // Track total drag distance
      dragDistance += Math.abs(deltaMove.x) + Math.abs(deltaMove.y)
      
      velocity.x = deltaMove.x * 0.005
      velocity.y = deltaMove.y * 0.005
      
      globe.rotation.y += velocity.x
      globe.rotation.x += velocity.y
      
      previousMousePosition = { x: event.clientX, y: event.clientY }
    }
  })
  
  renderer.domElement.addEventListener('mouseup', (event) => {
    // Check if this was a click (minimal dragging) rather than a drag
    const clickThreshold = 5 // pixels
    if (dragDistance < clickThreshold) {
      handleCountryClick(event)
    }
    
    isDragging = false
    
    const minMomentumThreshold = 0.02
    if (Math.abs(velocity.x) > minMomentumThreshold || Math.abs(velocity.y) > minMomentumThreshold) {
      momentum.x = velocity.x
      momentum.y = velocity.y
    } else {
      momentum.x = 0
      momentum.y = 0
    }
  })
  
  renderer.domElement.addEventListener('wheel', (event) => {
    updateMouseOverGlobe(event)
    
    if (isMouseOverGlobe) {
      event.preventDefault()
      camera.position.z += event.deltaY * 0.2
      camera.position.z = Math.max(150, Math.min(500, camera.position.z))
    }
  })

  renderer.domElement.addEventListener('dblclick', () => {
    if (globe && !isResetting) {
      resetStartRotation.x = globe.rotation.x
      resetStartRotation.y = globe.rotation.y
      resetStartRotation.z = globe.rotation.z
      resetProgress = 0
      isResetting = true
      momentum.x = 0
      momentum.y = 0
      cooldownTimer = 0
    }
  })

}

function animate() {
  requestAnimationFrame(animate)
  
  if (globe) {
    if (isResetting) {
      resetProgress += 0.02
      
      if (resetProgress >= 1) {
        globe.rotation.x = resetTarget.x
        globe.rotation.y = resetTarget.y
        globe.rotation.z = resetTarget.z
        camera.position.z = 300
        isResetting = false
        resetProgress = 0
      } else {
        const easeProgress = 1 - Math.pow(1 - resetProgress, 3)
        globe.rotation.x = resetStartRotation.x + (resetTarget.x - resetStartRotation.x) * easeProgress
        globe.rotation.y = resetStartRotation.y + (resetTarget.y - resetStartRotation.y) * easeProgress
        globe.rotation.z = resetStartRotation.z + (resetTarget.z - resetStartRotation.z) * easeProgress
        
        const startCameraZ = camera.position.z
        const targetCameraZ = 300
        camera.position.z = startCameraZ + (targetCameraZ - startCameraZ) * easeProgress
      }
    } else if (!isDragging) {
      globe.rotation.y += momentum.x
      globe.rotation.x += momentum.y
      
      momentum.x *= 0.94
      momentum.y *= 0.94
      
      if (Math.abs(momentum.x) < 0.001) momentum.x = 0
      if (Math.abs(momentum.y) < 0.001) momentum.y = 0
      
      if (momentum.x === 0 && momentum.y === 0) {
        cooldownTimer++
      } else {
        cooldownTimer = 0
      }
    } else {
      cooldownTimer = 0
    }
    
    if (!controls && !isDragging && !isResetting && momentum.x === 0 && momentum.y === 0 && cooldownTimer > 180) {
      globe.rotation.y -= 0.001
    }
  }
  
  renderer.render(scene, camera)
}

function toggleGrid() {
  showGrid = !showGrid
  const toggleButton = document.getElementById('grid-toggle')
  
  if (globe) {
    globe.showGraticules(showGrid)
  }
  
  if (showGrid) {
    toggleButton.classList.add('active')
    toggleButton.title = 'Hide Grid'
  } else {
    toggleButton.classList.remove('active')
    toggleButton.title = 'Show Grid'
  }
}

function toggleInfo() {
  const infoPopup = document.getElementById('info-popup')
  
  if (infoPopup.classList.contains('visible')) {
    infoPopup.classList.remove('visible')
    infoPopup.classList.add('hidden')
  } else {
    infoPopup.classList.remove('hidden')
    infoPopup.classList.add('visible')
  }
}

window.toggleGrid = toggleGrid
window.toggleInfo = toggleInfo

function getCountryColor(countryData) {
  if (!countryData) {
    return 'rgba(255, 255, 255, 0.15)' // Default semi-transparent white
  }
  
  const countryId = countryData.properties.NAME || countryData.properties.ADMIN
  
  // Check if this country has a persistent state (correct/incorrect)
  if (countryStates.has(countryId)) {
    const state = countryStates.get(countryId)
    if (state === 'correct') {
      return 'rgba(76, 175, 80, 0.6)' // Green - previously guessed correctly
    } else if (state === 'incorrect') {
      return 'rgba(244, 67, 54, 0.6)' // Red - previously guessed incorrectly
    }
  }
  
  // Check if this is the currently selected country
  const isSelected = selectedCountry && 
                    (countryData.properties.NAME === selectedCountry.properties.NAME ||
                     countryData.properties.ADMIN === selectedCountry.properties.ADMIN)
  
  if (isSelected) {
    // Color based on current guess status
    switch (countryGuessStatus) {
      case 'waiting':
        return 'rgba(255, 235, 59, 0.6)' // Yellow - country selected, waiting for guess
      case 'correct':
        return 'rgba(76, 175, 80, 0.6)' // Green - correct guess
      case 'incorrect':
        return 'rgba(244, 67, 54, 0.6)' // Red - incorrect guess
      default:
        return 'rgba(255, 235, 59, 0.6)' // Yellow - default for selected
    }
  }
  
  return 'rgba(255, 255, 255, 0.15)' // Default semi-transparent white
}

function showCountryInfo(countryData) {
  const countryInfoElement = document.getElementById('country-info')
  const countryNameElement = document.getElementById('country-name')
  const countryDetailsElement = document.getElementById('country-details')
  
  if (countryData) {
    countryNameElement.textContent = countryData.properties.NAME || 'Unknown'
    
    // Add some additional details
    const details = []
    if (countryData.properties.CONTINENT) {
      details.push(`Continent: ${countryData.properties.CONTINENT}`)
    }
    if (countryData.properties.SUBREGION) {
      details.push(`Region: ${countryData.properties.SUBREGION}`)
    }
    if (countryData.properties.POP_EST) {
      const population = parseInt(countryData.properties.POP_EST).toLocaleString()
      details.push(`Population: ${population}`)
    }
    
    countryDetailsElement.textContent = details.join(' • ')
    countryInfoElement.classList.remove('hidden')
  } else {
    countryInfoElement.classList.add('hidden')
  }
}

function hideCountryInfo() {
  const countryInfoElement = document.getElementById('country-info')
  countryInfoElement.classList.add('hidden')
}

function hideGuessContainer() {
  const guessContainer = document.getElementById('app').querySelector('.country-guess-container')
  if (guessContainer) {
    guessContainer.classList.remove('active')
  }
}

function selectCountry(countryData) {
  selectedCountry = countryData
  countryGuessStatus = 'waiting'
  
  // Show country info
  /*showCountryInfo(countryData)*/
  
  // Update globe colors
  globe.polygonCapColor(getCountryColor)
  
  // Show and setup guess container
  const guessContainer = document.getElementById('app').querySelector('.country-guess-container')
  const guessInput = document.getElementById('country-guess')
  const guessFeedback = document.getElementById('guess-feedback')
  
  guessContainer.classList.add('active')
  guessInput.value = ''
  
  // Check if this country was previously guessed
  const countryId = countryData.properties.NAME || countryData.properties.ADMIN
  const previousState = countryStates.get(countryId)
  
  if (previousState === 'correct') {
    guessFeedback.textContent = 'Previously correct! Try again.'
    guessFeedback.className = 'guess-feedback correct'
  } else if (previousState === 'incorrect') {
    guessFeedback.textContent = 'Previously incorrect! Try again.'
    guessFeedback.className = 'guess-feedback incorrect'
  } else {
    guessFeedback.textContent = 'Selected! Guess the country name.'
    guessFeedback.className = 'guess-feedback waiting'
  }
  
  // Focus on input field
  setTimeout(() => guessInput.focus(), 100)
}

function checkCountryGuess() {
  const guessInput = document.getElementById('country-guess')
  const guessFeedback = document.getElementById('guess-feedback')
  
  if (!selectedCountry) {
    guessFeedback.textContent = 'Click a country first'
    guessFeedback.className = 'guess-feedback waiting'
    return
  }
  
  const userGuess = guessInput.value.trim().toLowerCase()
  const countryName = (selectedCountry.properties.NAME || selectedCountry.properties.ADMIN || '').toLowerCase()
  
  if (userGuess === '') {
    guessFeedback.textContent = ''
    guessFeedback.className = 'guess-feedback waiting'
    return
  }
  
  const isCorrect = userGuess === countryName
  const countryId = selectedCountry.properties.NAME || selectedCountry.properties.ADMIN
  
  if (isCorrect) {
    countryGuessStatus = 'correct'
    countryStates.set(countryId, 'correct') // Store persistent state
    guessFeedback.textContent = `✓ Correct!`
    guessFeedback.className = 'guess-feedback correct'
  } else {
    countryGuessStatus = 'incorrect'
    countryStates.set(countryId, 'incorrect') // Store persistent state
    guessFeedback.textContent = `✗ Try again`
    guessFeedback.className = 'guess-feedback incorrect'
  }
  
  // Update globe colors
  globe.polygonCapColor(getCountryColor)
}

function onWindowResize() {
  const appElement = document.querySelector('#app')
  camera.aspect = appElement.clientWidth / appElement.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(appElement.clientWidth, appElement.clientHeight)
}

window.addEventListener('resize', onWindowResize)

// Set up guess input event listener
function setupGuessInput() {
  const guessInput = document.getElementById('country-guess')
  
  if (guessInput) {
    // Check guess on Enter key or input change
    guessInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        checkCountryGuess()
      }
    })
    
    // Also check on input change with a slight delay
    let timeout
    guessInput.addEventListener('input', () => {
      clearTimeout(timeout)
      timeout = setTimeout(checkCountryGuess, 500) // Check after 500ms of no typing
    })
  }
}

// Initialize hover functionality for portfolio images
function initImageHoverEffects() {
  // Get all academic work and project images
  const allImages = document.querySelectorAll('.ac-wo-image, .se-pr-image')
  
  allImages.forEach(img => {
    // Check if image has hover data attributes
    const hoverSrc = img.dataset.hoverSrc
    const hoverVideo = img.dataset.hoverVideo
    const hoverGif = img.dataset.hoverGif
    
    if (hoverSrc || hoverVideo || hoverGif) {
      // Create container div
      const container = document.createElement('div')
      container.className = 'image-hover-container'
      
      // Insert container before the image
      img.parentNode.insertBefore(container, img)
      
      // Move the original image into the container
      img.classList.add('original-media')
      container.appendChild(img)
      
      // Create hover element
      let hoverElement
      if (hoverVideo) {
        hoverElement = document.createElement('video')
        hoverElement.src = hoverVideo
        hoverElement.muted = true
        hoverElement.loop = true
        hoverElement.playsInline = true
        
        // Play video on hover, pause when not hovering
        container.addEventListener('mouseenter', () => {
          hoverElement.currentTime = 0
          hoverElement.play()
        })
        container.addEventListener('mouseleave', () => {
          hoverElement.pause()
          hoverElement.currentTime = 0
        })
      } else {
        hoverElement = document.createElement('img')
        hoverElement.src = hoverSrc || hoverGif
        hoverElement.alt = img.alt + ' (hover)'
      }
      
      hoverElement.classList.add('hover-media')
      container.appendChild(hoverElement)
    }
  })
}

init()
createGlobe()
addControls()
animate()
setupGuessInput()
initImageHoverEffects()
