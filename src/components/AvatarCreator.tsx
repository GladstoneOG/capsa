import React from 'react';

export interface AvatarConfig {
  skinColor: string;
  hairStyle: 'short' | 'spiky' | 'long' | 'bob' | 'bald' | 'cap';
  hairColor: string;
  expression: 'smile' | 'excited' | 'cool' | 'wink' | 'nervous';
  clothesColor: string;
}

export const SKIN_COLORS = [
  { name: 'Fair', value: '#FFDBAC' },
  { name: 'Peach', value: '#F1C27D' },
  { name: 'Olive', value: '#E0AC69' },
  { name: 'Bronze', value: '#C68642' },
  { name: 'Cocoa', value: '#8D5524' },
];

export const HAIR_STYLES: { name: string; value: AvatarConfig['hairStyle'] }[] = [
  { name: 'Short Crop', value: 'short' },
  { name: 'Spiky', value: 'spiky' },
  { name: 'Flowing Long', value: 'long' },
  { name: 'Bob Cut', value: 'bob' },
  { name: 'Cool Cap', value: 'cap' },
  { name: 'Smooth Bald', value: 'bald' },
];

export const HAIR_COLORS = [
  { name: 'Dark Jet', value: '#1A1A1A' },
  { name: 'Espresso', value: '#4A2F13' },
  { name: 'Gold Blonde', value: '#E5C158' },
  { name: 'Sunset Red', value: '#B83B1D' },
  { name: 'Electric Blue', value: '#1D72B8' },
  { name: 'Cyber Pink', value: '#B81D80' },
];

export const EXPRESSIONS: { name: string; value: AvatarConfig['expression'] }[] = [
  { name: 'Cheerful', value: 'smile' },
  { name: 'Thrilled', value: 'excited' },
  { name: 'Chill', value: 'cool' },
  { name: 'Playful Wink', value: 'wink' },
  { name: 'Sweating', value: 'nervous' },
];

export const CLOTHES_COLORS = [
  { name: 'Royal Purple', value: '#6B46C1' },
  { name: 'Deep Sea', value: '#2B6CB0' },
  { name: 'Crimson', value: '#C53030' },
  { name: 'Emerald', value: '#2F855A' },
  { name: 'Gold Amber', value: '#D69E2E' },
  { name: 'Neon Coral', value: '#ED64A6' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skinColor: '#F1C27D',
  hairStyle: 'short',
  hairColor: '#1A1A1A',
  expression: 'smile',
  clothesColor: '#6B46C1',
};

// Generates a random configuration
export function getRandomAvatar(): AvatarConfig {
  const rand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)].value;
  return {
    skinColor: rand(SKIN_COLORS),
    hairStyle: rand(HAIR_STYLES),
    hairColor: rand(HAIR_COLORS),
    expression: rand(EXPRESSIONS),
    clothesColor: rand(CLOTHES_COLORS),
  };
}

interface AvatarSVGProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export const AvatarSVG: React.FC<AvatarSVGProps> = ({ config, size = 80, className }) => {
  const { skinColor, hairStyle, hairColor, expression, clothesColor } = config;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: 'block', borderRadius: '50%', backgroundColor: '#1E293B', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
    >
      {/* Background ring glow */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="2" />

      {/* Body / Shoulders */}
      <path
        d="M 20,95 C 20,80 30,70 50,70 C 70,70 80,80 80,95 Z"
        fill={clothesColor}
      />
      {/* V-Neck Shirt Cutout */}
      <path
        d="M 43,70 L 50,78 L 57,70 Z"
        fill={skinColor}
      />

      {/* Neck */}
      <rect x="44" y="60" width="12" height="12" rx="3" fill={skinColor} />

      {/* Head / Face */}
      <circle cx="50" cy="45" r="22" fill={skinColor} />

      {/* Ears */}
      <circle cx="26" cy="45" r="4.5" fill={skinColor} />
      <circle cx="74" cy="45" r="4.5" fill={skinColor} />

      {/* Face Expression Elements */}
      {expression === 'smile' && (
        <>
          {/* Eyes */}
          <circle cx="42" cy="42" r="2.5" fill="#1E293B" />
          <circle cx="58" cy="42" r="2.5" fill="#1E293B" />
          {/* Smile */}
          <path d="M 43,51 Q 50,58 57,51" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {expression === 'excited' && (
        <>
          {/* Eyes */}
          <circle cx="42" cy="41" r="2.5" fill="#1E293B" />
          <circle cx="58" cy="41" r="2.5" fill="#1E293B" />
          {/* Wide open laughing mouth */}
          <path d="M 42,49 Q 50,59 58,49 Z" fill="#881337" stroke="#1E293B" strokeWidth="1.5" />
          <path d="M 45,51 Q 50,56 55,51" fill="#FDA4AF" />
        </>
      )}

      {expression === 'cool' && (
        <>
          {/* Sunglasses */}
          <path d="M 33,39 L 67,39 L 65,46 C 63,49 53,49 51,46 L 49,46 C 47,49 37,49 35,46 Z" fill="#0F172A" />
          <path d="M 33,39 L 26,42" stroke="#0F172A" strokeWidth="2" />
          <path d="M 67,39 L 74,42" stroke="#0F172A" strokeWidth="2" />
          <path d="M 36,41 L 43,45" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          {/* Cool smirk */}
          <path d="M 45,53 Q 48,51 54,54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {expression === 'wink' && (
        <>
          {/* Left Eye open */}
          <circle cx="42" cy="42" r="2.5" fill="#1E293B" />
          {/* Right Eye winking (arc) */}
          <path d="M 54,42 Q 58,39 62,42" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cheeky smile */}
          <path d="M 44,50 Q 51,57 56,50" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {expression === 'nervous' && (
        <>
          {/* Dot eyes */}
          <circle cx="42" cy="42" r="2" fill="#1E293B" />
          <circle cx="58" cy="42" r="2" fill="#1E293B" />
          {/* Flat worried mouth */}
          <path d="M 44,53 L 56,51" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          {/* Sweat drop */}
          <path d="M 70,32 C 70,35 68,37 67,37 C 66,37 65,35 67,32 Z" fill="#60A5FA" />
        </>
      )}

      {/* Hair Styles */}
      {hairStyle === 'short' && (
        <path
          d="M 28,38 C 28,20 40,16 50,16 C 60,16 72,20 72,38 C 72,38 75,32 71,28 C 67,24 61,22 50,22 C 39,22 33,24 29,28 C 25,32 28,38 28,38 Z"
          fill={hairColor}
        />
      )}

      {hairStyle === 'spiky' && (
        <path
          d="M 28,36 L 31,24 L 37,28 L 42,16 L 47,24 L 53,14 L 59,24 L 64,17 L 69,27 L 73,22 L 72,36 Z"
          fill={hairColor}
        />
      )}

      {hairStyle === 'long' && (
        <>
          {/* Back hair */}
          <path
            d="M 28,45 C 28,30 35,20 50,20 C 65,20 72,30 72,45 C 72,60 76,68 76,75 C 76,78 72,80 70,75 C 68,70 70,55 70,45 C 70,25 30,25 30,45 C 30,55 32,70 30,75 C 28,80 24,78 24,75 C 24,68 28,60 28,45 Z"
            fill={hairColor}
          />
          {/* Bangs */}
          <path
            d="M 28,36 C 30,28 38,24 50,26 C 62,24 70,28 72,36 C 68,32 60,30 50,32 C 40,30 32,32 28,36 Z"
            fill={hairColor}
          />
        </>
      )}

      {hairStyle === 'bob' && (
        <path
          d="M 27,45 C 26,30 32,20 50,20 C 68,20 74,30 73,45 C 73,50 71,55 74,58 C 73,60 70,58 70,52 C 70,26 30,26 30,52 C 30,58 27,60 26,58 C 29,55 27,50 27,45 Z"
          fill={hairColor}
        />
      )}

      {hairStyle === 'cap' && (
        <>
          {/* Hat base */}
          <path d="M 28,38 C 28,22 40,20 50,20 C 60,20 72,22 72,38 Z" fill={clothesColor} />
          {/* Visor/Brim */}
          <path d="M 24,38 Q 50,30 76,38 Q 65,43 24,38" fill="#1E293B" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          {/* Badge */}
          <circle cx="50" cy="29" r="3.5" fill="#E5C158" />
        </>
      )}

      {hairStyle === 'bald' && (
        // Glare on bald head
        <path d="M 33,30 C 35,27 42,25 45,25 C 41,27 35,32 35,35 Z" fill="rgba(255,255,255,0.2)" />
      )}
    </svg>
  );
};

interface AvatarCreatorProps {
  config: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

export const AvatarCreator: React.FC<AvatarCreatorProps> = ({ config, onChange }) => {
  const updateProp = (key: keyof AvatarConfig, val: string) => {
    onChange({ ...config, [key]: val });
  };

  return (
    <div className="avatar-creator">
      <div className="avatar-preview-box">
        <AvatarSVG config={config} size={110} />
        <button
          type="button"
          className="random-avatar-btn"
          onClick={() => onChange(getRandomAvatar())}
        >
          🎲 Randomize
        </button>
      </div>

      <div className="avatar-controls-grid">
        <div className="control-group">
          <label>Skin Color</label>
          <div className="color-options">
            {SKIN_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`color-dot ${config.skinColor === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
                onClick={() => updateProp('skinColor', c.value)}
              />
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Hair Style</label>
          <select
            value={config.hairStyle}
            onChange={(e) => updateProp('hairStyle', e.target.value)}
          >
            {HAIR_STYLES.map((h) => (
              <option key={h.value} value={h.value}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {config.hairStyle !== 'bald' && (
          <div className="control-group">
            <label>Hair Color</label>
            <div className="color-options">
              {HAIR_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-dot ${config.hairColor === c.value ? 'selected' : ''}`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                  onClick={() => updateProp('hairColor', c.value)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="control-group">
          <label>Expression</label>
          <select
            value={config.expression}
            onChange={(e) => updateProp('expression', e.target.value)}
          >
            {EXPRESSIONS.map((ex) => (
              <option key={ex.value} value={ex.value}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Shirt Color</label>
          <div className="color-options">
            {CLOTHES_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`color-dot ${config.clothesColor === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
                onClick={() => updateProp('clothesColor', c.value)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
