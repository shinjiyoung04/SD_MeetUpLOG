import {
  memo,
  useMemo,
} from 'react'

const GAME_PRESETS = [
  'galaga',
  'snake',
]

const TRAVEL_PRESETS = [
  'sunny',
  'cloudy',
  'storm',
]

const pickPagePreset = (presets) =>
  presets[
    Math.floor(
      Math.random() * presets.length,
    )
  ]

const MovieFilmSequence = ({
  sequenceKey,
}) => (
  <div
    className="movie-film-sequence"
    aria-hidden="true"
  >
    {Array.from(
      { length: 14 },
      (_, index) => (
        <i key={`${sequenceKey}-${index}`} />
      ),
    )}
  </div>
)

const MovieBackdrop = () => (
  <>
    <div className="movie-cinema-glow" />

    <div className="movie-side-film movie-side-film-left">
      <div className="movie-side-film-track">
        <MovieFilmSequence sequenceKey="left-a" />
        <MovieFilmSequence sequenceKey="left-b" />
      </div>
    </div>

    <div className="movie-side-film movie-side-film-right">
      <div className="movie-side-film-track">
        <MovieFilmSequence sequenceKey="right-a" />
        <MovieFilmSequence sequenceKey="right-b" />
      </div>
    </div>
  </>
)

const GalagaBackdrop = () => (
  <div className="pixel-stage pixel-stage-galaga">
    <div className="galaga-stars"><i /><i /><i /><i /><i /><i /></div>
    <div className="galaga-enemies"><i /><i /><i /><i /></div>
    <div className="galaga-laser"><i /><i /></div>
    <div className="galaga-ship"><i /><i /><i /></div>
    <span className="pixel-score">1UP&nbsp;00420</span>
  </div>
)

const SnakeBackdrop = () => (
  <div className="pixel-stage pixel-stage-snake">
    <div className="snake-board">
      {Array.from(
        { length: 11 },
        (_, index) => (
          <i
            key={index}
            className={index === 0 ? 'snake-head' : 'snake-segment'}
            style={{
              '--snake-delay': `${-(10 - index) * 0.18}s`,
            }}
          />
        ),
      )}
      <span className="snake-food snake-food-one" />
      <span className="snake-food snake-food-two" />
    </div>
    <span className="pixel-score">SCORE&nbsp;016</span>
  </div>
)

const GameBackdrop = ({
  preset,
}) => (
  <div className={`game-preset game-preset-${preset}`}>
    {preset === 'galaga' && <GalagaBackdrop />}
    {preset === 'snake' && <SnakeBackdrop />}
  </div>
)

const FoodBackdrop = () => (
  <div className="food-table-scene">
    <div className="food-steam"><i /><i /><i /></div>
    <div className="food-plate">
      <span className="food-plate-ring" />
      <span className="food-garnish garnish-one" />
      <span className="food-garnish garnish-two" />
      <span className="food-garnish garnish-three" />
    </div>
    <div className="food-cutlery food-fork"><i /><i /><i /></div>
    <div className="food-cutlery food-knife" />
  </div>
)

const TravelBackdrop = ({
  preset,
}) => (
  <div className={`travel-window travel-weather-${preset}`}>
    <div className="travel-sky">
      <span className="travel-sun" />
      <div className="travel-cloud cloud-a"><i /><i /></div>
      <div className="travel-cloud cloud-b"><i /><i /></div>
      <div className="travel-cloud cloud-c"><i /><i /></div>
      <div className="travel-rain"><i /><i /><i /><i /><i /></div>
      <span className="travel-lightning" />
      <span className="travel-wing" />
    </div>
    <span className="travel-window-highlight" />
  </div>
)

const RoomThemeBackdrop = ({
  topicType,
  roomKey,
}) => {
  const type = String(
    topicType || 'ETC',
  ).toUpperCase()
  const themeKey =
    type === 'ETC'
      ? 'default'
      : type.toLowerCase()

  const randomPresets =
    useMemo(
      () => ({
        game:
          pickPagePreset(
            GAME_PRESETS,
          ),
        travel:
          pickPagePreset(
            TRAVEL_PRESETS,
          ),
      }),
      [roomKey],
    )

  return (
    <div
      className={`room-theme-backdrop room-theme-${themeKey}`}
      aria-hidden="true"
    >
      <div className="room-theme-ambient" />
      {type === 'MOVIE' && <MovieBackdrop />}
      {type === 'GAME' && (
        <GameBackdrop
          preset={randomPresets.game}
        />
      )}
      {type === 'FOOD' && <FoodBackdrop />}
      {type === 'TRAVEL' && (
        <TravelBackdrop
          preset={randomPresets.travel}
        />
      )}
    </div>
  )
}

export default memo(RoomThemeBackdrop)
