import React, { useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { HYDERABAD_AREAS } from '../data/initialSalonData';
import { HyderabadArea } from '../types/salon';

interface HyderabadMapPickerProps {
  selectedAreaName: string;
  coordinates: { lat: number; lng: number };
  onSelectArea: (area: HyderabadArea) => void;
  onUpdateCoordinates: (coords: { lat: number; lng: number }) => void;
}

const MIN_LAT = 17.375;
const MAX_LAT = 17.495;
const MIN_LNG = 78.320;
const MAX_LNG = 78.515;

export const HyderabadMapPicker: React.FC<HyderabadMapPickerProps> = ({
  selectedAreaName,
  coordinates,
  onSelectArea,
  onUpdateCoordinates,
}) => {
  const [geoStatus, setGeoStatus] = useState<string>(
    'Click any locality pin on the Hyderabad map or calibrate GPS coordinates.'
  );

  const latLngToSvg = (lat: number, lng: number) => {
    const clampedLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
    const clampedLng = Math.max(MIN_LNG, Math.min(MAX_LNG, lng));
    const x = ((clampedLng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * 540 + 30;
    const y = (1 - (clampedLat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 260 + 30;
    return { x, y };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 600;
    const clickY = ((e.clientY - rect.top) / rect.height) * 320;

    const lng = Number(
      (MIN_LNG + ((Math.max(30, Math.min(570, clickX)) - 30) / 540) * (MAX_LNG - MIN_LNG)).toFixed(
        4
      )
    );
    const lat = Number(
      (
        MIN_LAT +
        (1 - (Math.max(30, Math.min(290, clickY)) - 30) / 260) * (MAX_LAT - MIN_LAT)
      ).toFixed(4)
    );

    let nearest = HYDERABAD_AREAS[0];
    let minDistance = Infinity;
    for (const area of HYDERABAD_AREAS) {
      const dist = Math.hypot(area.lat - lat, area.lng - lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = area;
      }
    }

    onSelectArea(nearest);
    onUpdateCoordinates({ lat, lng });
    setGeoStatus(
      `Pin locked in Hyderabad (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E) · Nearest hub: ${nearest.name}`
    );
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser GPS unavailable; using Jubilee Hills Flagship coordinates.');
      return;
    }
    setGeoStatus('Detecting GPS coordinates inside Greater Hyderabad limits...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const isInsideHyderabad =
          latitude >= 17.2 && latitude <= 17.65 && longitude >= 78.15 && longitude <= 78.75;

        if (isInsideHyderabad) {
          const lat = Number(latitude.toFixed(4));
          const lng = Number(longitude.toFixed(4));
          onUpdateCoordinates({ lat, lng });
          setGeoStatus(`Verified live Hyderabad GPS coordinates: ${lat}° N, ${lng}° E`);
        } else {
          const currentArea =
            HYDERABAD_AREAS.find((a) => a.name === selectedAreaName) || HYDERABAD_AREAS[0];
          onUpdateCoordinates({ lat: currentArea.lat, lng: currentArea.lng });
          setGeoStatus(
            `Service operates exclusively inside Hyderabad city limits. Calibrated to ${currentArea.name} (${currentArea.lat}° N, ${currentArea.lng}° E).`
          );
        }
      },
      () => {
        const currentArea =
          HYDERABAD_AREAS.find((a) => a.name === selectedAreaName) || HYDERABAD_AREAS[0];
        onUpdateCoordinates({ lat: currentArea.lat, lng: currentArea.lng });
        setGeoStatus(
          `Calibrated to ${currentArea.name}, Hyderabad (${currentArea.lat}° N, ${currentArea.lng}° E).`
        );
      },
      { timeout: 5000 }
    );
  };

  const activePin = latLngToSvg(coordinates.lat, coordinates.lng);

  return (
    <div className="border border-[#E7DED1] bg-[#FAF7F2] min-w-0">
      <div className="px-4 py-3 bg-[#F3EDE2] border-b border-[#E7DED1] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#292720]">
            Interactive Hyderabad Municipal Map & Coordinate Lock
          </h4>
          <p className="text-xs text-[#79756C]">
            Exclusively serving Greater Hyderabad, Telangana (500001–500090)
          </p>
        </div>
        <button
          type="button"
          onClick={handleDetectGps}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#292720] text-white hover:bg-[#9A7950] transition-colors"
        >
          <LocateFixed className="w-3.5 h-3.5 shrink-0" />
          <span>Calibrate Hyderabad GPS</span>
        </button>
      </div>

      <div className="relative bg-[#EFE8DC] overflow-x-auto">
        <svg
          viewBox="0 0 600 320"
          className="w-full h-auto min-w-[460px] cursor-crosshair select-none"
          onClick={handleSvgClick}
          role="img"
          aria-label="Interactive map of Hyderabad localities"
        >
          <defs>
            <pattern id="hydGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#292720"
                strokeWidth="0.5"
                strokeOpacity="0.08"
              />
            </pattern>
          </defs>

          <rect width="600" height="320" fill="url(#hydGrid)" />

          {/* Outer Ring Road (ORR) */}
          <path
            d="M 85 20 C 35 120, 45 225, 130 300 C 260 315, 460 305, 565 250"
            fill="none"
            stroke="#9A7950"
            strokeWidth="3"
            strokeDasharray="6 4"
            strokeOpacity="0.4"
          />
          <text x="62" y="285" fontSize="9" fontFamily="monospace" fill="#9A7950" opacity="0.85">
            NEHRU OUTER RING ROAD (ORR)
          </text>

          {/* Musi River Corridor */}
          <path
            d="M 20 265 Q 190 245, 340 260 T 590 240"
            fill="none"
            stroke="#93B5C6"
            strokeWidth="6"
            strokeOpacity="0.45"
          />

          {/* Hussain Sagar Lake */}
          <path
            d="M 385 140 C 380 122, 412 122, 415 140 C 418 158, 400 175, 398 182 C 394 174, 382 158, 385 140 Z"
            fill="#93B5C6"
            fillOpacity="0.65"
            stroke="#5B8296"
            strokeWidth="1"
          />
          <text x="422" y="158" fontSize="9" fontFamily="sans-serif" fill="#446475" fontWeight="600">
            Hussain Sagar
          </text>

          {/* KBR National Park */}
          <ellipse
            cx="285"
            cy="170"
            rx="24"
            ry="15"
            fill="#64765B"
            fillOpacity="0.25"
            stroke="#4C6545"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Plot All 14 Hyderabad Localities */}
          {HYDERABAD_AREAS.map((area) => {
            const pos = latLngToSvg(area.lat, area.lng);
            const isSelected = area.name === selectedAreaName;
            return (
              <g
                key={area.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectArea(area);
                  onUpdateCoordinates({ lat: area.lat, lng: area.lng });
                  setGeoStatus(
                    `Selected ${area.name} (${area.pinCode}) · ${area.lat}° N, ${area.lng}° E`
                  );
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 7 : 4.5}
                  fill={isSelected ? '#9A7950' : '#292720'}
                  stroke="#FAF7F2"
                  strokeWidth="2"
                />
                <text
                  x={pos.x + 9}
                  y={pos.y + 3}
                  fontSize={isSelected ? '11' : '9.5'}
                  fontWeight={isSelected ? '700' : '500'}
                  fill={isSelected ? '#9A7950' : '#292720'}
                  fontFamily="DM Sans, sans-serif"
                >
                  {area.name}
                </text>
              </g>
            );
          })}

          {/* Active Selected Coordinate Crosshair */}
          <g transform={`translate(${activePin.x}, ${activePin.y})`}>
            <circle r="14" fill="#9A7950" fillOpacity="0.2" />
            <circle r="4" fill="#9A7950" stroke="#FAF7F2" strokeWidth="1.5" />
          </g>
        </svg>
      </div>

      <div className="px-4 py-2.5 bg-white border-t border-[#E7DED1] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#79756C] min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#9A7950] shrink-0" />
          <span className="min-w-0">{geoStatus}</span>
        </div>
        <div className="flex items-center gap-3 font-mono-tabular text-[#292720] font-medium">
          <span>LAT: {coordinates.lat.toFixed(4)}° N</span>
          <span>·</span>
          <span>LNG: {coordinates.lng.toFixed(4)}° E</span>
        </div>
      </div>
    </div>
  );
};
