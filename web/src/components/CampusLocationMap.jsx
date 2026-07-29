import campusMapImage from '../assets/map/shanghaitech-campus-map-3d.jpg';
import { campusMapImageBoundaries, campusMapLocations, campusMapMeta } from '../campusMapData.js';

const CAMPUS_MAP_VIEW_WIDTH = campusMapMeta.imageCalibration?.imageWidth || 100;
const CAMPUS_MAP_VIEW_HEIGHT = campusMapMeta.imageCalibration?.imageHeight || 100;

export default function CampusLocationMap({ selectedId, onSelect }) {
  const mappedLocations = campusMapLocations.filter((location) => Number.isFinite(location.x) && Number.isFinite(location.y));

  function handleKeyDown(event, locationId) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(locationId);
  }

  function handleMapClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
    const location = findMapLocation(point, mappedLocations);
    if (location) onSelect(location.id);
  }

  return (
    <div className="campus-map-shell">
      <img className="campus-map-image" src={campusMapImage} alt="" loading="eager" decoding="async" />
      <svg className="campus-map" viewBox={`0 0 ${CAMPUS_MAP_VIEW_WIDTH} ${CAMPUS_MAP_VIEW_HEIGHT}`} role="img" aria-label="上海科技大学校内地点地图" onClick={handleMapClick}>
        {campusMapImageBoundaries.map((boundary) => (
          <polygon
            key={boundary.id}
            className={`campus-map-image-boundary ${boundary.family || ''}`}
            points={pointsAttr(boundary.points)}
          />
        ))}
        {mappedLocations.map((location) => {
          const isSelected = location.id === selectedId;
          const hasShape = location.mapShapes?.length > 0;
          const shapes = hasShape && Array.isArray(location.mapShapes[0])
            ? location.mapShapes
            : hasShape
              ? [location.mapShapes]
              : [];
          return (
            <g
              key={location.id}
              className={`campus-map-location ${location.sourceType || 'building'} ${isSelected ? 'selected' : ''}`}
              data-location-id={location.id}
              role="button"
              tabIndex="0"
              aria-label={location.name}
              onClick={() => onSelect(location.id)}
              onKeyDown={(event) => handleKeyDown(event, location.id)}
            >
              <title>{location.name}</title>
              {hasShape ? (
                shapes.map((shape, index) => (
                  <polygon key={`${location.id}-${index}`} points={pointsAttr(shape)} />
                ))
              ) : (
                <circle className="campus-map-point" cx={mapX(location.x)} cy={mapY(location.y)} r={mapR(isSelected ? 1.75 : 1.05)} />
              )}
              <circle className="campus-map-dot" cx={mapX(location.x)} cy={mapY(location.y)} r={mapR(isSelected ? 1.9 : 0.85)} />
              {isSelected && (
                <text className="campus-map-label" x={mapX(location.x)} y={mapY(Math.max(location.y - 2.8, 4))}>
                  {shortLocationLabel(location.name)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function mapX(value) {
  return (value / 100) * CAMPUS_MAP_VIEW_WIDTH;
}

function mapY(value) {
  return (value / 100) * CAMPUS_MAP_VIEW_HEIGHT;
}

function mapR(value) {
  return (value / 100) * CAMPUS_MAP_VIEW_HEIGHT;
}

function findMapLocation(point, candidates) {
  let contained = null;
  let containedArea = Infinity;
  let nearest = null;
  let nearestDistance = Infinity;

  candidates.forEach((location) => {
    const distance = distanceToLocation(point, location);
    if (distance < nearestDistance) {
      nearest = location;
      nearestDistance = distance;
    }

    const shapes = normalizedMapShapes(location);
    if (!shapes.length) return;
    const containingShapes = shapes.filter((shape) => pointInPolygon(point, shape));
    if (!containingShapes.length) return;
    const area = Math.min(...containingShapes.map(polygonArea));

    if (area < containedArea || (area === containedArea && distance < distanceToLocation(point, contained))) {
      contained = location;
      containedArea = area;
    }
  });

  if (contained) return contained;
  if (nearestDistance <= 2) return nearest;
  return nearestDistance <= 4.2 ? nearest : null;
}

function normalizedMapShapes(location) {
  if (!location.mapShapes?.length) return [];
  return Array.isArray(location.mapShapes[0]) ? location.mapShapes : [location.mapShapes];
}

function distanceToLocation(point, location) {
  return Math.hypot(point.x - location.x, point.y - location.y);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const currentX = Array.isArray(currentPoint) ? currentPoint[0] : currentPoint.x;
    const currentY = Array.isArray(currentPoint) ? currentPoint[1] : currentPoint.y;
    const previousX = Array.isArray(previousPoint) ? previousPoint[0] : previousPoint.x;
    const previousY = Array.isArray(previousPoint) ? previousPoint[1] : previousPoint.y;
    const crosses = (currentY > point.y) !== (previousY > point.y);
    if (!crosses) continue;
    const intersectX = ((previousX - currentX) * (point.y - currentY)) / (previousY - currentY) + currentX;
    if (point.x < intersectX) inside = !inside;
  }
  return inside;
}

function polygonArea(polygon) {
  if (!polygon?.length) return Infinity;
  let area = 0;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const currentX = Array.isArray(currentPoint) ? currentPoint[0] : currentPoint.x;
    const currentY = Array.isArray(currentPoint) ? currentPoint[1] : currentPoint.y;
    const previousX = Array.isArray(previousPoint) ? previousPoint[0] : previousPoint.x;
    const previousY = Array.isArray(previousPoint) ? previousPoint[1] : previousPoint.y;
    area += (previousX * currentY) - (currentX * previousY);
  }
  return Math.abs(area) / 2;
}

function pointsAttr(points) {
  return points
    .map((point) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      return `${mapX(x)},${mapY(y)}`;
    })
    .join(' ');
}

function shortLocationLabel(name) {
  const chars = Array.from(name || '');
  return chars.length > 8 ? `${chars.slice(0, 8).join('')}...` : chars.join('');
}
