/*-------------------------------------------------------------------------
 * drawElements Quality Program OpenGL ES Utilities
 * ------------------------------------------------
 *
 * Copyright 2014 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

'use strict';
goog.provide('framework.common.tcuBilinearImageCompare');
goog.require('framework.common.tcuRGBA');
goog.require('framework.common.tcuTexture');
goog.require('framework.delibs.debase.deMath');

goog.scope(function() {

    var tcuBilinearImageCompare = framework.common.tcuBilinearImageCompare;
    var deMath = framework.delibs.debase.deMath;
    var tcuTexture = framework.common.tcuTexture;
    var tcuRGBA = framework.common.tcuRGBA;

    var DE_ASSERT = function(x) {
        if (!x)
            throw new Error('Assert failed');
    };

    // for bilinear interpolation
    /** @const {number} */ tcuBilinearImageCompare.NUM_SUBPIXEL_BITS = 8;

    // Algorithm assumes that colors are packed to 32-bit values as dictated by
    // tcu::RGBA::*_SHIFT values.

    /**
    * @param {number} fx1 deUint32
    * @param {number} fy1 deUint32
    * @param {number} p00 deUint8
    * @param {number} p01 deUint8
    * @param {number} p10 deUint8
    * @param {number} p11 deUint8
    * @return {number} deUint8
    */
    tcuBilinearImageCompare.interpolateChannel = function(fx1, fy1, p00, p01, p10, p11) {
        /** @const {number} */ var fx0 = (1 << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS) - fx1;
        /** @const {number} */ var fy0 = (1 << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS) - fy1;
        /** @const {number} */
        var half = 1 << (tcuBilinearImageCompare.NUM_SUBPIXEL_BITS * 2 - 1);
        /** @const {number} */ var sum =
            (fx0 * fy0 * p00) +
            (fx1 * fy0 * p10) +
            (fx0 * fy1 * p01) +
            (fx1 * fy1 * p11);
        /** @const {number} */
        var rounded = (sum + half) >> (tcuBilinearImageCompare.NUM_SUBPIXEL_BITS * 2);

        DE_ASSERT(deMath.deInRange32(rounded, 0, 0xff));
        return rounded;
    };

    /**
     * @param {tcuTexture.RGBA8View} view
     * @param {number} u
     * @param {number} v
     * @return {tcuRGBA.RGBA}
     */
    tcuBilinearImageCompare.bilinearSampleRGBA8 = function(view, u, v) {
        /** @type {number} */ var x0 = u >> tcuBilinearImageCompare.NUM_SUBPIXEL_BITS;
        /** @type {number} */ var y0 = v >> tcuBilinearImageCompare.NUM_SUBPIXEL_BITS;
        /** @type {number} */ var x1 = x0 + 1;
        /** @type {number} */ var y1 = y0 + 1;

        DE_ASSERT(x1 < view.getWidth());
        DE_ASSERT(y1 < view.getHeight());

        /** @type {number} */ var fx1 = u - (x0 << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS);
        /** @type {number} */ var fy1 = v - (y0 << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS);

        /** @type {Array<number>} */ var channelsP00 = view.read(x0, y0);
        /** @type {Array<number>} */ var channelsP10 = view.read(x1, y0);
        /** @type {Array<number>} */ var channelsP01 = view.read(x0, y1);
        /** @type {Array<number>} */ var channelsP11 = view.read(x1, y1);

        /** @type {Array<number>} */ var res = [];

        res[0] = tcuBilinearImageCompare.interpolateChannel(fx1, fy1, channelsP00[0],
            channelsP01[0], channelsP10[0], channelsP11[0]);
        res[1] = tcuBilinearImageCompare.interpolateChannel(fx1, fy1, channelsP00[1],
            channelsP01[1], channelsP10[1], channelsP11[1]);
        res[2] = tcuBilinearImageCompare.interpolateChannel(fx1, fy1, channelsP00[2],
            channelsP01[2], channelsP10[2], channelsP11[2]);
        res[3] = tcuBilinearImageCompare.interpolateChannel(fx1, fy1, channelsP00[3],
            channelsP01[3], channelsP10[3], channelsP11[3]);

        return tcuRGBA.newRGBAFromArray(res);
    };

    /**
     * @param {tcuTexture.RGBA8View} reference
     * @param {tcuTexture.RGBA8View} result
     * @param {tcuRGBA.RGBA} threshold
     * @param {number} x
     * @param {number} y
     * @return {boolean}
     */
    tcuBilinearImageCompare.comparePixelRGBA8 = function(reference, result, threshold, x, y) {
        /** @const {tcuRGBA.RGBA} */ var resPix = tcuRGBA.newRGBAFromArray(result.read(x, y));

        // Step 1: Compare result pixel to 3x3 neighborhood pixels in reference.
        /** @const {number} */ var x0 = Math.max(x - 1, 0);
        /** @const {number} */ var x1 = x;
        /** @const {number} */
        var x2 = Math.min(x + 1, reference.getWidth() - 1);
        /** @const {number} */ var y0 = Math.max(y - 1, 0);
        /** @const {number} */ var y1 = y;
        /** @const {number} */
        var y2 = Math.min(y + 1, reference.getHeight() - 1);

        //tcuBilinearImageCompare.readRGBA8List (reference, x0, y0, x2, y2);

        if (tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x1, y1)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x0, y1)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x2, y1)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x0, y0)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x1, y0)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x2, y0)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x0, y2)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x1, y2)), threshold) ||
            tcuRGBA.compareThreshold(resPix, tcuRGBA.newRGBAFromArray(reference.read(x2, y2)), threshold))
            return true;

        // Step 2: Compare using bilinear sampling.
        // \todo [pyry] Optimize sample positions!
        /** @const {Array<Array<number>>} */ var s_offsets = [
            [226, 186],
            [335, 235],
            [279, 334],
            [178, 272],
            [112, 202],
            [306, 117],
            [396, 299],
            [206, 382],
            [146, 96],
            [423, 155],
            [361, 412],
            [84, 339],
            [48, 130],
            [367, 43],
            [455, 367],
            [105, 439],
            [83, 46],
            [217, 24],
            [461, 71],
            [450, 459],
            [239, 469],
            [67, 267],
            [459, 255],
            [13, 416],
            [10, 192],
            [141, 502],
            [503, 304],
            [380, 506]
        ];

        for (var sampleNdx = 0; sampleNdx < s_offsets.length; sampleNdx++) {
            /** @const {number} */
            var u = ((x - 1) << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS) + s_offsets[sampleNdx][0];
            /** @const {number} */
            var v = ((y - 1) << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS) + s_offsets[sampleNdx][1];

            if (!deMath.deInBounds32(u, 0, (reference.getWidth() - 1) << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS) ||
                !deMath.deInBounds32(v, 0, (reference.getHeight() - 1) << tcuBilinearImageCompare.NUM_SUBPIXEL_BITS))
                continue;

            if (tcuRGBA.compareThreshold(resPix, tcuBilinearImageCompare.bilinearSampleRGBA8(reference, u, v), threshold))
                return true;
        }

        return false;
    };

    /**
     * @param {tcuTexture.RGBA8View} reference
     * @param {tcuTexture.RGBA8View} result
     * @param {tcuTexture.PixelBufferAccess} errorMask
     * @param {tcuRGBA.RGBA} threshold
     * @return {boolean}
     */
    tcuBilinearImageCompare.bilinearCompareRGBA8 = function(reference, result, errorMask, threshold) {
        DE_ASSERT(reference.getFormat().isEqual(new tcuTexture.TextureFormat(
            tcuTexture.ChannelOrder.RGBA, tcuTexture.ChannelType.UNORM_INT8)));
        DE_ASSERT(result.getFormat().isEqual(new tcuTexture.TextureFormat(
            tcuTexture.ChannelOrder.RGBA, tcuTexture.ChannelType.UNORM_INT8)));

        // Clear error mask first to green (faster this way).
        errorMask.clear([0.0, 1.0, 0.0, 1.0]);

        /** @type {boolean} */ var allOk = true;

        for (var y = 0; y < reference.getHeight(); y++) {
            for (var x = 0; x < reference.getWidth(); x++) {
                if (!tcuBilinearImageCompare.comparePixelRGBA8(reference, result, threshold, x, y) &&
                    !tcuBilinearImageCompare.comparePixelRGBA8(result, reference, threshold, x, y)) {
                    allOk = false;
                    errorMask.setPixel([1.0, 0.0, 0.0, 1.0], x, y);
                }
            }
        }

        return allOk;
    };

    /**
     * @param {tcuTexture.ConstPixelBufferAccess} reference
     * @param {tcuTexture.ConstPixelBufferAccess} result
     * @param {tcuTexture.PixelBufferAccess} errorMask
     * @param {tcuRGBA.RGBA} threshold
     * @return {boolean}
     */
    tcuBilinearImageCompare.bilinearCompare = function(reference, result, errorMask, threshold) {
        assertMsgOptions(result.getWidth() == reference.getWidth() && result.getHeight() == reference.getHeight() && result.getDepth() == reference.getDepth(),
            'Reference and result images have different dimensions', false, true);

        assertMsgOptions(errorMask.getWidth() == reference.getWidth() && errorMask.getHeight() == reference.getHeight() && errorMask.getDepth() == reference.getDepth(),
            'Reference and error mask images have different dimensions', false, true);

        /** @type {boolean} */ var isEqual = reference.getFormat().isEqual(
            new tcuTexture.TextureFormat(
                tcuTexture.ChannelOrder.RGBA,
                tcuTexture.ChannelType.UNORM_INT8));
        if (isEqual) {
            /** @type {tcuTexture.RGBA8View} */ var refView = new tcuTexture.RGBA8View(reference);
            /** @type {tcuTexture.RGBA8View} */ var resView = new tcuTexture.RGBA8View(result);
            return tcuBilinearImageCompare.bilinearCompareRGBA8(refView, resView, errorMask, threshold);
        } else
            throw new Error('Unsupported format for bilinear comparison');
    };

});
