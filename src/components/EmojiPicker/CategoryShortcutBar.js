import React from 'react';
import PropTypes from 'prop-types';
import {View, Text} from 'react-native';
import styles from '../../styles/styles';

const propTypes = {
    /** The function to call when an emoji is selected */
    onPress: PropTypes.func.isRequired,

    /** The indices that the icons should link to */
    headerIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
};

const CategoryShortcutBar = (props) => {

    return (
        <View style={[styles.pt2, styles.ph4, styles.flexRow]}>
            <Text>test</Text>
        </View>
    );
};
CategoryShortcutBar.propTypes = propTypes;
CategoryShortcutBar.displayName = 'CategoryShortcutBar';

export default CategoryShortcutBar;