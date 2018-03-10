import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';

import { omit } from '../../utils';
import { buildSmoothPath, buildLinearPath, injectStyleTag } from '../../helpers/DOM.helpers';
import { normalize } from '../../helpers/math.helpers';
import { generateId } from '../../helpers/misc.helpers';
import { normalizeDataset, generateAutoDrawCss } from './Trend.helpers';
import { sortBy, findIndex } from 'lodash';

const propTypes = {
	data: PropTypes.arrayOf(
		PropTypes.oneOfType([
			PropTypes.number,
			PropTypes.shape({
				value: PropTypes.number,
			}),
		]).isRequired
	).isRequired,
	smooth: PropTypes.bool,
	autoDraw: PropTypes.bool,
	autoDrawDuration: PropTypes.number,
	autoDrawEasing: PropTypes.string,
	width: PropTypes.number,
	height: PropTypes.number,
	padding: PropTypes.number,
	radius: PropTypes.number,
	score: PropTypes.number,
	ranges: PropTypes.array,
	gradient: PropTypes.arrayOf(PropTypes.string),
};

const defaultProps = {
	radius: 10,
	stroke: 'black',
	padding: 8,
	strokeWidth: 1,
	autoDraw: false,
	autoDrawDuration: 2000,
	autoDrawEasing: 'ease',
};

class Trend extends Component {
	constructor(props) {
		super(props);

		// Generate a random ID. This is important for distinguishing between
		// Trend components on a page, so that they can have different keyframe
		// animations.
		this.trendId = generateId();
		this.gradientId = `react-trend-vertical-gradient-${this.trendId}`;
	}

	componentDidMount() {
		const { autoDraw, autoDrawDuration, autoDrawEasing } = this.props;

		if (autoDraw) {
			this.lineLength = this.path.getTotalLength();

			const css = generateAutoDrawCss({
				id: this.trendId,
				lineLength: this.lineLength,
				duration: autoDrawDuration,
				easing: autoDrawEasing,
			});

			injectStyleTag(css);
		}
	}

	getDelegatedProps() {
		return omit(this.props, Object.keys(propTypes));
	}

	componentDidUpdate() {
		const segmentList = findDOMNode(this.path).getTotalLength();
	}

	renderGradientDefinition() {
		const { gradient, ranges } = this.props;
		return (
			<defs>
				<linearGradient id={this.gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor={gradient[0]} />
					<stop offset="33%" stopColor={gradient[0]} />
					<stop offset="33%" stopColor={gradient[1]} />
					<stop offset="67%" stopColor={gradient[1]} />
					<stop offset="67%" stopColor={gradient[2]} />
					<stop offset="100%" stopColor={gradient[2]} />
				</linearGradient>
			</defs>
		);
	}

	render() {
		const { data, smooth, width, height, padding, radius, gradient, score } = this.props;

		// We need at least 2 points to draw a graph.
		if (!data || data.length < 2) {
			return null;
		}

		// `data` can either be an array of numbers:
		// [1, 2, 3]
		// or, an array of objects containing a value:
		// [ { value: 1 }, { value: 2 }, { value: 3 }]
		//
		// For now, we're just going to convert the second form to the first.
		// Later on, if/when we support tooltips, we may adjust.
		const plainValues = data.map(point => (typeof point === 'number' ? point : point.value));

		// Our viewbox needs to be in absolute units, so we'll default to 300x75
		// Our SVG can be a %, though; this is what makes it scalable.
		// By defaulting to percentages, the SVG will grow to fill its parent
		// container, preserving a 1/4 aspect ratio.
		const viewBoxWidth = width || 300;
		const viewBoxHeight = height || 75;
		const svgWidth = width || '100%';
		const svgHeight = height || '25%';

		const normalizedValues = normalizeDataset(plainValues, {
			minX: padding,
			maxX: viewBoxWidth - padding,
			// NOTE: Because SVGs are indexed from the top left, but most data is
			// indexed from the bottom left, we're inverting the Y min/max.
			minY: viewBoxHeight - padding,
			maxY: padding,
		});

		const pointPosition = getPointPosition(normalizedValues, score);

		const path = smooth ? buildSmoothPath(normalizedValues, { radius }) : buildLinearPath(normalizedValues);

		return (
			<svg
				width={svgWidth}
				height={svgHeight}
				viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
				{...this.getDelegatedProps()}
			>
				{gradient && this.renderGradientDefinition()}

				<path
					ref={elem => {
						this.path = elem;
					}}
					id={`react-trend-${this.trendId}`}
					d={path}
					fill="none"
					stroke={gradient ? `url(#${this.gradientId})` : undefined}
				/>
				<line x1={pointPosition.x} x2={pointPosition.x} y2={viewBoxHeight} strokeWidth="1" />
				<circle cx={pointPosition.x} cy={0 + 3.5} r="3" strokeWidth="1" />
			</svg>
		);
	}
}

Trend.propTypes = propTypes;
Trend.defaultProps = defaultProps;

export default Trend;

function getPointPosition(values, score) {
	const index = findIndex(sortBy(values, 'value'), item => item.value > score);
	return values[index] ? values[index] : values[values.length - 1];
}
