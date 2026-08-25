const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js'

const PROVIDER_TYPE_LABELS = {
  flatrate: '구독',
  free: '무료',
  ads: '광고 포함 무료',
  rent: '대여',
  buy: '구매',
}

const CINEMA_LABELS = {
  CGV: 'CGV',
  LOTTE: '롯데시네마',
  LOTTE_CINEMA: '롯데시네마',
  MEGABOX: '메가박스',
}

const normalizeProviderName = (value = '') =>
  value.toLocaleLowerCase().replace(/[\s+._-]/g, '')

const providerSearchTarget = (providerName, title) => {
  const name = normalizeProviderName(providerName)
  const query = encodeURIComponent(title)

  if (name.includes('netflix') || name.includes('넷플릭스')) {
    return {
      url: `https://www.netflix.com/search?q=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('disney') || name.includes('디즈니')) {
    // Disney+ does not read a movie title from a public query parameter.
    // Open its real search surface and let the click handler copy the title.
    return {
      url: 'https://www.disneyplus.com/ko-kr/browse/search',
      titleSearchSupported: false,
    }
  }
  if (name.includes('watcha') || name.includes('왓챠')) {
    return {
      url: `https://watcha.com/ko/search?query=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('wavve') || name.includes('웨이브')) {
    return {
      url: `https://www.wavve.com/search?searchWord=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('tving') || name.includes('티빙')) {
    return {
      url: `https://www.tving.com/search?keyword=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('coupang') || name.includes('쿠팡')) {
    return {
      url: `https://www.coupangplay.com/search?q=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('amazon') || name.includes('primevideo') || name.includes('프라임')) {
    return {
      url: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('appletv') || name.includes('애플tv') || name.includes('apple')) {
    return {
      url: `https://tv.apple.com/kr/search?term=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('googleplay') || name.includes('구글플레이')) {
    return {
      url: `https://play.google.com/store/search?q=${query}&c=movies`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('mubi') || name.includes('무비')) {
    return {
      url: `https://mubi.com/en/search/films?query=${query}`,
      titleSearchSupported: true,
    }
  }
  if (name.includes('laftel') || name.includes('라프텔')) {
    // LAFTEL documents in-app title search but does not publish a stable
    // title-bearing web URL, so avoid generating an unverified deep link.
    return {
      url: 'https://laftel.net/',
      titleSearchSupported: false,
    }
  }

  return null
}

export const getProviderTypeLabel = (type) =>
  PROVIDER_TYPE_LABELS[type] ?? '시청'

export const getProviderLogoUrl = (provider) => {
  const path = provider?.logo_path ?? provider?.logoPath
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `https://image.tmdb.org/t/p/w92${path}`
}

export const getMovieWatchLinks = (movie) => {
  if (!movie) return []

  const links = []
  const seen = new Set()
  const providers = Array.isArray(movie.providers) ? movie.providers : []

  providers.forEach((provider) => {
    const target = providerSearchTarget(provider.name, movie.title)
    if (!target) return

    const key = `${normalizeProviderName(provider.name)}:${provider.type ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    links.push({
      kind: 'OTT',
      name: provider.name,
      detail: getProviderTypeLabel(provider.type),
      logoUrl: getProviderLogoUrl(provider),
      url: target.url,
      titleSearchSupported: target.titleSearchSupported,
      type: provider.type ?? null,
    })
  })

  const cinemaSources = Array.isArray(movie.cinemaSources)
    ? movie.cinemaSources
    : Array.isArray(movie.cinema_sources)
      ? movie.cinema_sources
      : []

  cinemaSources.forEach((source) => {
    const url = source?.source_url ?? source?.sourceUrl
    if (!/^https?:\/\//i.test(url ?? '')) return

    const name = CINEMA_LABELS[source.cinema] ?? source.cinema ?? '영화관'
    const key = `cinema:${name}:${url}`
    if (seen.has(key)) return
    seen.add(key)
    links.push({
      kind: 'CINEMA',
      name,
      detail: source.booking_available === false ? '상영 정보' : '예매',
      logoUrl: null,
      url,
      type: null,
    })
  })

  return links
}

export const getOttWatchLinks = (movie) =>
  getMovieWatchLinks(movie).filter((link) => link.kind === 'OTT')

export const getPrimaryOttWatchLink = (movie) => {
  const links = getOttWatchLinks(movie)
  return links.find((link) => link.type === 'flatrate')
    ?? links[0]
    ?? null
}

export const getTmdbMovieLink = (movie) => {
  const tmdbId = movie?.tmdbId ?? movie?.tmdb_id
  if (tmdbId === null || tmdbId === undefined || tmdbId === '') return null
  return `https://www.themoviedb.org/movie/${encodeURIComponent(String(tmdbId))}?language=ko-KR`
}

export const getPrimaryWatchLink = (movie) => {
  const ottLink = getPrimaryOttWatchLink(movie)
  if (ottLink) return ottLink

  const cinemaLink = getCinemaBookingLinks(movie)[0]
  return cinemaLink ?? null
}

export const getCinemaBookingLinks = (movie) =>
  getMovieWatchLinks(movie).filter(
    (link) =>
      link.kind === 'CINEMA' &&
      link.detail === '예매' &&
      /^https?:\/\//i.test(link.url ?? ''),
  )

export const getPrimaryCinemaBookingLink = (movie) =>
  getCinemaBookingLinks(movie)[0] ?? null

let kakaoSdkPromise = null

const loadKakaoSdk = () => {
  if (window.Kakao) return Promise.resolve(window.Kakao)
  if (kakaoSdkPromise) return kakaoSdkPromise

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${KAKAO_SDK_URL}"]`)
    const script = existing ?? document.createElement('script')

    const handleLoad = () => window.Kakao
      ? resolve(window.Kakao)
      : reject(new Error('카카오 SDK를 초기화하지 못했습니다.'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('카카오 SDK를 불러오지 못했습니다.')),
      { once: true },
    )

    if (!existing) {
      script.src = KAKAO_SDK_URL
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }
  }).catch((error) => {
    kakaoSdkPromise = null
    throw error
  })

  return kakaoSdkPromise
}

const fallbackShare = async (movie, url) => {
  const text = `MeetupLog에서 확정한 영화: ${movie.title}${movie.genres ? ` (${movie.genres})` : ''}`

  if (navigator.share) {
    await navigator.share({ title: movie.title, text, url })
    return 'NATIVE'
  }

  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'COPIED'
}

export const shareMovieToKakao = async (movie) => {
  if (!movie) throw new Error('공유할 영화 정보가 없습니다.')

  const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim() || window.location.origin
  const watchLink = getPrimaryWatchLink(movie)
  const fallbackUrl = watchLink?.url ?? publicAppUrl
  const javascriptKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim()

  if (!javascriptKey) {
    return fallbackShare(movie, fallbackUrl)
  }

  const Kakao = await loadKakaoSdk()
  if (!Kakao.isInitialized()) Kakao.init(javascriptKey)

  const description = [
    movie.genres,
    movie.runtime,
    watchLink ? `${watchLink.name}에서 시청 가능` : null,
  ].filter(Boolean).join(' · ').slice(0, 180)

  await Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `이번 영화는 ${movie.title}`,
      description: description || 'MeetupLog AI 추천으로 함께 고른 영화예요.',
      imageUrl: movie.posterUrl || `${publicAppUrl.replace(/\/$/, '')}/favicon.svg`,
      link: {
        mobileWebUrl: publicAppUrl,
        webUrl: publicAppUrl,
      },
    },
    buttons: [
      {
        title: 'MeetupLog 열기',
        link: {
          mobileWebUrl: publicAppUrl,
          webUrl: publicAppUrl,
        },
      },
    ],
  })

  return 'KAKAO'
}
